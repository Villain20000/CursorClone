import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getEnv } from "../config/index.js";
import { prisma } from "../db/index.js";

export interface AuthPayload {
  userId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];
  const { JWT_ACCESS_SECRET } = getEnv();

  try {
    const payload = jwt.verify(token, JWT_ACCESS_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.split(" ")[1];
  const { JWT_ACCESS_SECRET } = getEnv();

  try {
    const payload = jwt.verify(token, JWT_ACCESS_SECRET) as AuthPayload;
    req.user = payload;
  } catch {
    // silently continue — auth is optional
  }
  next();
}

export async function adminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user || req.user.role !== "ADMIN") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

export async function projectAccessMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { projectId } = req.params as Record<string, string>;
  if (!projectId) {
    next();
    return;
  }

  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId: req.user.userId },
  });

  const project = await prisma.project.findFirst({
    where: { id: projectId, visibility: { not: "PRIVATE" } },
  });

  if (!member && !project) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  next();
}
