import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

const settingsSchema = z.object({
  theme: z.enum(["dark", "light", "system"]).optional(),
  fontSize: z.number().int().min(8).max(72).optional(),
  keymap: z.enum(["default", "vim", "emacs"]).optional(),
  tabSize: z.number().int().min(1).max(8).optional(),
  wordWrap: z.boolean().optional(),
  minimap: z.boolean().optional(),
});

// GET /settings
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    let settings = await prisma.userSetting.findFirst({
      where: { userId: req.user!.userId },
    });

    if (!settings) {
      settings = await prisma.userSetting.create({
        data: { userId: req.user!.userId },
      });
    }

    res.json(settings);
  } catch (e) {
    console.error("Get settings error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /settings
router.put("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const updates = settingsSchema.parse(req.body);
    const keys = Object.keys(updates) as (keyof typeof updates)[];

    if (keys.length === 0) {
      res.json({ message: "No updates provided" });
      return;
    }

    const data: Record<string, unknown> = {};
    for (const key of keys) {
      if (updates[key] !== undefined) data[key] = updates[key];
    }

    let settings = await prisma.userSetting.upsert({
      where: { userId: req.user!.userId },
      update: data,
      create: { userId: req.user!.userId, ...data },
    });

    res.json(settings);
  } catch (e) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: e.issues });
      return;
    }
    console.error("Update settings error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
