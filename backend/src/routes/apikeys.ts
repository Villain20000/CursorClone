import { Router, Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// Generate a new API key
router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, scopes, expiresAt } = req.body as {
      name: string;
      scopes?: string[];
      expiresAt?: string;
    };

    // Generate raw key (prefix_cc_32randomchars)
    const raw = `cc_${crypto.randomBytes(24).toString("hex")}`;
    const hash = crypto.createHash("sha256").update(raw).digest("hex");
    const prefix = raw.slice(0, 8);

    const key = await prisma.apiKey.create({
      data: {
        userId: req.user!.userId,
        name: name || "API Key",
        prefix,
        hash,
        scopes: scopes || [],
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    // Return raw key only once — never stored
    res.status(201).json({
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      key: raw,
      scopes: key.scopes,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
    });
  } catch (e) {
    console.error("Create API key error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// List API keys (without raw key)
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId: req.user!.userId },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
    res.json(keys);
  } catch (e) {
    console.error("List API keys error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete API key
router.delete("/:keyId", authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.apiKey.deleteMany({
      where: {
        id: req.params.keyId as string,
        userId: req.user!.userId,
      },
    });
    res.json({ message: "API key deleted" });
  } catch (e) {
    console.error("Delete API key error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
