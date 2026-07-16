import { Router, Request, Response } from "express";
import { prisma } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// GET /users/:id (public profile)
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id as string },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        _count: { select: { ownedProjects: true } },
      },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  } catch (e) {
    console.error("Get user error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /users/me (update own profile)
router.put("/me", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { displayName, username, avatarUrl } = req.body;
    const update: Record<string, unknown> = {};
    if (displayName !== undefined) update.displayName = displayName;
    if (username !== undefined) update.username = username;
    if (avatarUrl !== undefined) update.avatarUrl = avatarUrl;

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: update,
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        role: true,
      },
    });
    res.json(user);
  } catch (e) {
    console.error("Update user error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /users/me/sessions (list active sessions)
router.get("/me/sessions", authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessions = await prisma.session.findMany({
      where: { userId: req.user!.userId, revoked: false, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(sessions);
  } catch (e) {
    console.error("List sessions error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /users/me/sessions/:sessionId (revoke a session)
router.delete("/me/sessions/:sessionId", authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.session.updateMany({
      where: {
        id: req.params.sessionId as string,
        userId: req.user!.userId,
      },
      data: { revoked: true },
    });
    res.json({ message: "Session revoked" });
  } catch (e) {
    console.error("Revoke session error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
