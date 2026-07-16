import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/index.js";
import { authMiddleware, projectAccessMiddleware } from "../middleware/auth.js";

const router = Router();

const aiConfigSchema = z.object({
  provider: z.enum(["OLLAMA", "OPENAI", "ANTHROPIC", "CUSTOM"]).optional(),
  model: z.string().min(1).optional(),
  baseUrl: z.string().url().optional().or(z.literal("")),
  apiKey: z.string().optional().or(z.literal("")),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(128000).optional(),
  systemPrompt: z.string().optional(),
});

// GET /ai/config (user-level AI config)
router.get("/config", authMiddleware, async (req: Request, res: Response) => {
  try {
    let config = await prisma.aIConfig.findFirst({
      where: { userId: req.user!.userId, projectId: null },
    });

    if (!config) {
      config = await prisma.aIConfig.create({
        data: {
          userId: req.user!.userId,
          provider: "OLLAMA",
          model: "qwen2.5-coder:7b",
        },
      });
    }

    // Don't expose raw API key
    const { apiKey, ...safe } = config;
    res.json({ ...safe, hasApiKey: !!apiKey });
  } catch (e) {
    console.error("Get AI config error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /ai/config (update user-level AI config)
router.put("/config", authMiddleware, async (req: Request, res: Response) => {
  try {
    const updates = aiConfigSchema.parse(req.body);
    const keys = Object.keys(updates) as (keyof typeof updates)[];

    if (keys.length === 0) {
      res.json({ message: "No updates provided" });
      return;
    }

    const data: Record<string, unknown> = {};
    for (const key of keys) {
      if (updates[key] !== undefined) data[key] = updates[key];
    }

    let config = await prisma.aIConfig.findFirst({
      where: { userId: req.user!.userId, projectId: null },
    });

    if (config) {
      config = await prisma.aIConfig.update({
        where: { id: config.id },
        data,
      });
    } else {
      config = await prisma.aIConfig.create({
        data: { userId: req.user!.userId, projectId: null, model: "qwen2.5-coder:7b", ...data },
      });
    }

    const { apiKey, ...safe } = config;
    res.json({ ...safe, hasApiKey: !!apiKey });
  } catch (e) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: e.issues });
      return;
    }
    console.error("Update AI config error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /ai/config/project/:projectId
router.get("/config/project/:projectId", authMiddleware, projectAccessMiddleware, async (req: Request, res: Response) => {
  try {
    const config = await prisma.aIConfig.findFirst({
      where: { projectId: req.params.projectId as string },
    });

    if (!config) {
      res.status(404).json({ error: "No project-level AI config found" });
      return;
    }

    const { apiKey, ...safe } = config;
    res.json({ ...safe, hasApiKey: !!apiKey });
  } catch (e) {
    console.error("Get project AI config error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /ai/config/project/:projectId
router.put("/config/project/:projectId", authMiddleware, projectAccessMiddleware, async (req: Request, res: Response) => {
  try {
    const updates = aiConfigSchema.parse(req.body);
    const keys = Object.keys(updates) as (keyof typeof updates)[];

    if (keys.length === 0) {
      res.json({ message: "No updates provided" });
      return;
    }

    const data: Record<string, unknown> = {};
    for (const key of keys) {
      if (updates[key] !== undefined) data[key] = updates[key];
    }

    let config = await prisma.aIConfig.findFirst({
      where: { projectId: req.params.projectId as string },
    });

    if (config) {
      config = await prisma.aIConfig.update({
        where: { id: config.id },
        data,
      });
    } else {
      config = await prisma.aIConfig.create({
        data: { projectId: req.params.projectId as string, userId: req.user!.userId, model: "qwen2.5-coder:7b", ...data },
      });
    }

    const { apiKey, ...safe } = config;
    res.json({ ...safe, hasApiKey: !!apiKey });
  } catch (e) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: e.issues });
      return;
    }
    console.error("Update project AI config error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /ai/chat — proxy chat request to configured AI provider
router.post("/chat", authMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      messages: z.array(z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string(),
      })),
      model: z.string().optional(),
      projectId: z.string().optional(),
      stream: z.boolean().default(false),
    });
    const { messages, model, projectId, stream } = schema.parse(req.body);

    // Get config
    let config = await prisma.aIConfig.findFirst({
      where: projectId
        ? { projectId }
        : { userId: req.user!.userId, projectId: null },
    });

    if (!config) {
      config = await prisma.aIConfig.create({
        data: {
          userId: req.user!.userId,
          projectId: projectId || null,
          provider: "OLLAMA",
          model: model || "qwen2.5-coder:7b",
        },
      });
    }

    const targetModel = model || config.model;
    const baseUrl = config.baseUrl || "http://localhost:11434";
    const apiKey = config.apiKey;

    if (config.provider === "OLLAMA") {
      // Proxy to Ollama
      const url = baseUrl.replace(/\/$/, "") + "/api/chat";
      const res_ollama = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: targetModel,
          messages,
          stream,
        }),
      });

      if (!res_ollama.ok) {
        res.status(res_ollama.status).json({ error: "Ollama request failed" });
        return;
      }

      if (stream && res_ollama.body) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res_ollama.body.pipeTo(res as unknown as WritableStream);
        return;
      }

      const data = await res_ollama.json();
      res.json(data);
    } else if (config.provider === "OPENAI" || config.provider === "CUSTOM") {
      if (!apiKey) {
        res.status(400).json({ error: "API key not configured" });
        return;
      }

      const url = config.provider === "OPENAI"
        ? "https://api.openai.com/v1/chat/completions"
        : baseUrl.replace(/\/$/, "") + "/chat/completions";

      const res_ai = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: targetModel,
          messages,
          stream,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
        }),
      });

      if (!res_ai.ok) {
        res.status(res_ai.status).json({ error: "AI request failed" });
        return;
      }

      if (stream && res_ai.body) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res_ai.body.pipeTo(res as unknown as WritableStream);
        return;
      }

      const data = await res_ai.json();
      res.json(data);
    } else if (config.provider === "ANTHROPIC") {
      if (!apiKey) {
        res.status(400).json({ error: "API key not configured" });
        return;
      }

      const url = "https://api.anthropic.com/v1/messages";
      const res_ai = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: targetModel,
          max_tokens: config.maxTokens,
          messages: messages.filter((m) => m.role !== "system"),
          system: messages.find((m) => m.role === "system")?.content,
        }),
      });

      if (!res_ai.ok) {
        res.status(res_ai.status).json({ error: "AI request failed" });
        return;
      }

      const data = await res_ai.json();
      res.json(data);
    } else {
      res.status(400).json({ error: "Unsupported AI provider" });
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: e.issues });
      return;
    }
    console.error("AI chat error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
