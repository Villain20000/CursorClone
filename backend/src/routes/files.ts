import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/index.js";
import { authMiddleware, projectAccessMiddleware } from "../middleware/auth.js";
import { createHash } from "crypto";

const router = Router();

const syncFileSchema = z.object({
  path: z.string().min(1),
  content: z.string().optional(),
});

// GET /files/:projectId/tree — list all files in a project
router.get("/:projectId/tree", authMiddleware, projectAccessMiddleware, async (req: Request, res: Response) => {
  try {
    const files = await prisma.fileSync.findMany({
      where: { projectId: req.params.projectId as string },
      select: { path: true, size: true, sha256: true, updatedAt: true },
      orderBy: { path: "asc" },
    });

    // Build tree structure
    const root: Record<string, unknown> = {};
    for (const file of files) {
      const parts = file.path.split("/");
      let current = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) current[part] = {};
        current = current[part] as Record<string, unknown>;
      }
      const name = parts[parts.length - 1];
      current[name] = {
        _file: true,
        size: file.size,
        sha256: file.sha256,
        updatedAt: file.updatedAt,
      };
    }

    res.json(root);
  } catch (e) {
    console.error("List files error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /files/:projectId/:path* — read a file
router.get("/:projectId/*", authMiddleware, projectAccessMiddleware, async (req: Request, res: Response) => {
  try {
    const filePath = req.params[0] as string;
    if (!filePath) {
      res.status(400).json({ error: "File path required" });
      return;
    }

    const file = await prisma.fileSync.findFirst({
      where: { projectId: req.params.projectId as string, path: filePath },
    });

    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    res.json({
      path: file.path,
      content: file.content,
      size: file.size,
      sha256: file.sha256,
      updatedAt: file.updatedAt,
    });
  } catch (e) {
    console.error("Read file error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /files/:projectId/* — create or update a file
router.put("/:projectId/*", authMiddleware, projectAccessMiddleware, async (req: Request, res: Response) => {
  try {
    const filePath = req.params[0] as string;
    if (!filePath) {
      res.status(400).json({ error: "File path required" });
      return;
    }

    const { content } = z.object({ content: z.string().optional() }).parse(req.body);
    const contentStr = content || "";
    const sha256 = createHash("sha256").update(contentStr).digest("hex");

    const existing = await prisma.fileSync.findFirst({
      where: { projectId: req.params.projectId as string, path: filePath },
    });

    let file;
    if (existing) {
      file = await prisma.fileSync.update({
        where: { id: existing.id },
        data: {
          content: contentStr,
          size: Buffer.byteLength(contentStr),
          sha256,
          userId: req.user!.userId,
        },
      });
    } else {
      file = await prisma.fileSync.create({
        data: {
          projectId: req.params.projectId as string,
          userId: req.user!.userId,
          path: filePath,
          content: contentStr,
          size: Buffer.byteLength(contentStr),
          sha256,
        },
      });
    }

    res.json(file);
  } catch (e) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: e.issues });
      return;
    }
    console.error("Write file error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /files/:projectId/* — delete a file
router.delete("/:projectId/*", authMiddleware, projectAccessMiddleware, async (req: Request, res: Response) => {
  try {
    const filePath = req.params[0] as string;
    if (!filePath) {
      res.status(400).json({ error: "File path required" });
      return;
    }

    await prisma.fileSync.deleteMany({
      where: { projectId: req.params.projectId as string, path: filePath },
    });

    res.json({ message: "File deleted" });
  } catch (e) {
    console.error("Delete file error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /files/:projectId/sync — batch sync (upsert multiple files)
router.post("/:projectId/sync", authMiddleware, projectAccessMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      files: z.array(z.object({
        path: z.string().min(1),
        content: z.string().optional(),
        sha256: z.string().optional(),
      })),
    });
    const { files } = schema.parse(req.body);

    const results = [];
    for (const file of files) {
      const contentStr = file.content || "";
      const sha256 = file.sha256 || createHash("sha256").update(contentStr).digest("hex");

      const existing = await prisma.fileSync.findFirst({
        where: { projectId: req.params.projectId as string, path: file.path },
      });

      let result;
      if (existing) {
        result = await prisma.fileSync.update({
          where: { id: existing.id },
          data: {
            content: contentStr,
            size: Buffer.byteLength(contentStr),
            sha256,
            userId: req.user!.userId,
          },
        });
      } else {
        result = await prisma.fileSync.create({
          data: {
            projectId: req.params.projectId as string,
            userId: req.user!.userId,
            path: file.path,
            content: contentStr,
            size: Buffer.byteLength(contentStr),
            sha256,
          },
        });
      }
      results.push(result);
    }

    res.json(results);
  } catch (e) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: e.issues });
      return;
    }
    console.error("Batch sync error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
