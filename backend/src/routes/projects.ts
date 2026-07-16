import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/index.js";
import { authMiddleware, projectAccessMiddleware } from "../middleware/auth.js";

const router = Router();

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  visibility: z.enum(["PRIVATE", "PUBLIC", "TEAM"]).default("PRIVATE"),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  visibility: z.enum(["PRIVATE", "PUBLIC", "TEAM"]).optional(),
});

// GET /projects (list user's projects)
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const memberships = await prisma.projectMember.findMany({
      where: { userId: req.user!.userId },
      include: {
        project: {
          include: {
            owner: { select: { id: true, username: true, displayName: true } },
            _count: { select: { members: true, files: true } },
          },
        },
      },
    });

    const owned = await prisma.project.findMany({
      where: { ownerId: req.user!.userId },
      include: {
        _count: { select: { members: true, files: true } },
      },
    });

    const projects = [
      ...memberships.map((m) => ({
        ...m.project,
        memberRole: m.role,
      })),
      ...owned.map((p) => ({
        ...p,
        memberRole: "OWNER" as const,
      })),
    ];

    // Deduplicate by project id
    const unique = projects.filter(
      (p, idx, arr) => arr.findIndex((x) => x.id === p.id) === idx
    );

    res.json(unique);
  } catch (e) {
    console.error("List projects error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /projects (create new project)
router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, description, visibility } = createProjectSchema.parse(req.body);

    const project = await prisma.project.create({
      data: {
        name,
        description,
        visibility,
        ownerId: req.user!.userId,
      },
      include: {
        owner: { select: { id: true, username: true, displayName: true } },
      },
    });

    // Create owner member entry
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: req.user!.userId,
        role: "OWNER",
      },
    });

    res.status(201).json(project);
  } catch (e) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: e.issues });
      return;
    }
    console.error("Create project error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /projects/:projectId
router.get("/:projectId", authMiddleware, projectAccessMiddleware, async (req: Request, res: Response) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.projectId as string },
      include: {
        owner: { select: { id: true, username: true, displayName: true } },
        members: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
        _count: { select: { files: true } },
      },
    });

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    res.json(project);
  } catch (e) {
    console.error("Get project error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /projects/:projectId
router.put("/:projectId", authMiddleware, projectAccessMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, description, visibility } = updateProjectSchema.parse(req.body);

    const member = await prisma.projectMember.findFirst({
      where: { projectId: req.params.projectId as string, userId: req.user!.userId },
    });

    if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
      res.status(403).json({ error: "Admin or owner access required" });
      return;
    }

    const project = await prisma.project.update({
      where: { id: req.params.projectId as string },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(visibility !== undefined && { visibility }),
      },
    });

    res.json(project);
  } catch (e) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: e.issues });
      return;
    }
    console.error("Update project error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /projects/:projectId
router.delete("/:projectId", authMiddleware, projectAccessMiddleware, async (req: Request, res: Response) => {
  try {
    const member = await prisma.projectMember.findFirst({
      where: { projectId: req.params.projectId as string, userId: req.user!.userId },
    });

    if (!member || member.role !== "OWNER") {
      res.status(403).json({ error: "Owner access required" });
      return;
    }

    await prisma.project.delete({ where: { id: req.params.projectId as string } });
    res.json({ message: "Project deleted" });
  } catch (e) {
    console.error("Delete project error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /projects/:projectId/members (invite member)
router.post("/:projectId/members", authMiddleware, projectAccessMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
    });
    const { email, role } = schema.parse(req.body);

    const member = await prisma.projectMember.findFirst({
      where: { projectId: req.params.projectId as string, userId: req.user!.userId },
    });
    if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
      res.status(403).json({ error: "Admin or owner access required" });
      return;
    }

    const targetUser = await prisma.user.findFirst({ where: { email } });
    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const existing = await prisma.projectMember.findFirst({
      where: {
        projectId: req.params.projectId as string,
        userId: targetUser.id,
      },
    });
    if (existing) {
      res.status(409).json({ error: "User is already a member" });
      return;
    }

    const newMember = await prisma.projectMember.create({
      data: {
        projectId: req.params.projectId as string,
        userId: targetUser.id,
        role,
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    res.status(201).json(newMember);
  } catch (e) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: e.issues });
      return;
    }
    console.error("Add member error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /projects/:projectId/members/:userId
router.delete("/:projectId/members/:userId", authMiddleware, projectAccessMiddleware, async (req: Request, res: Response) => {
  try {
    const member = await prisma.projectMember.findFirst({
      where: { projectId: req.params.projectId as string, userId: req.user!.userId },
    });
    if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
      res.status(403).json({ error: "Admin or owner access required" });
      return;
    }

    await prisma.projectMember.deleteMany({
      where: {
        projectId: req.params.projectId as string,
        userId: req.params.userId as string,
      },
    });

    res.json({ message: "Member removed" });
  } catch (e) {
    console.error("Remove member error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
