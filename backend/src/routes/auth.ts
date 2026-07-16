import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../db/index.js";
import { getEnv } from "../config/index.js";
import { authMiddleware } from "../middleware/auth.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// ─── Schemas ────────────────────────────────────────────────────────
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(3).max(30).optional(),
  displayName: z.string().max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

// ─── Helpers ────────────────────────────────────────────────────────
function generateTokens(userId: string, role: string) {
  const {
    JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET,
    JWT_ACCESS_EXPIRY,
    JWT_REFRESH_EXPIRY,
  } = getEnv();

  const accessToken = jwt.sign({ userId, role }, JWT_ACCESS_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRY as jwt.SignOptions["expiresIn"],
  });

  const refreshTokenId = uuidv4();
  const refreshToken = jwt.sign({ id: refreshTokenId, userId }, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRY as jwt.SignOptions["expiresIn"],
  });

  const expiresAt = new Date();
  const expirySeconds = parseExpiry(JWT_REFRESH_EXPIRY);
  expiresAt.setSeconds(expiresAt.getSeconds() + expirySeconds);

  return { accessToken, refreshToken, refreshTokenId, expiresAt };
}

// Parse a jwt-like expiry string (e.g. "15m", "7d", "30s") into seconds
function parseExpiry(value: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(value.trim());
  if (!match) return 7 * 24 * 60 * 60;
  const num = parseInt(match[1], 10);
  const unit = match[2];
  const mult: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return num * mult[unit];
}

async function storeRefreshToken(
  tokenId: string,
  userId: string,
  token: string,
  expiresAt: Date,
  req: Request
) {
  await prisma.refreshToken.create({
    data: {
      id: tokenId,
      token: token, // store hashed
      userId,
      expiresAt,
    },
  });

  // Also create a session
  await prisma.session.create({
    data: {
      userId,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip || req.socket.remoteAddress || undefined,
      expiresAt,
    },
  });
}

// ─── Routes ─────────────────────────────────────────────────────────

// POST /auth/register
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, username, displayName } = registerSchema.parse(req.body);

    const existing = await prisma.user.findFirst({
      where: { email },
    });
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const { BCRYPT_ROUNDS } = getEnv();
    const passwordHash = await bcrypt.hash(password, parseInt(BCRYPT_ROUNDS));

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        username: username || email.split("@")[0],
        displayName: displayName || username || email.split("@")[0],
      },
    });

    // Create default settings
    await prisma.userSetting.create({
      data: { userId: user.id },
    });

    const { accessToken, refreshToken, refreshTokenId, expiresAt } = generateTokens(
      user.id,
      user.role
    );
    await storeRefreshToken(refreshTokenId, user.id, refreshToken, expiresAt, req);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: e.issues });
      return;
    }
    console.error("Register error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findFirst({ where: { email } });
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const { accessToken, refreshToken, refreshTokenId, expiresAt } = generateTokens(
      user.id,
      user.role
    );
    await storeRefreshToken(refreshTokenId, user.id, refreshToken, expiresAt, req);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: e.issues });
      return;
    }
    console.error("Login error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/refresh
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = refreshTokenSchema.parse(req.body);
    const { JWT_REFRESH_SECRET } = getEnv();

    const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as {
      id: string;
      userId: string;
    };

    const token = await prisma.refreshToken.findFirst({
      where: { id: payload.id, revoked: false },
    });

    if (!token || token.expiresAt < new Date()) {
      res.status(401).json({ error: "Invalid or expired refresh token" });
      return;
    }

    const user = await prisma.user.findFirst({ where: { id: payload.userId } });
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    // Revoke old token
    await prisma.refreshToken.update({
      where: { id: token.id },
      data: { usedAt: new Date(), revoked: true },
    });

    const {
      accessToken: newAccess,
      refreshToken: newRefresh,
      refreshTokenId: newId,
      expiresAt,
    } = generateTokens(user.id, user.role);
    await storeRefreshToken(newId, user.id, newRefresh, expiresAt, req);

    res.json({ accessToken: newAccess, refreshToken: newRefresh });
  } catch (e) {
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

// POST /auth/logout
router.post("/logout", authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.session.updateMany({
      where: { userId: req.user!.userId, revoked: false },
      data: { revoked: true },
    });
    await prisma.refreshToken.updateMany({
      where: { userId: req.user!.userId, revoked: false },
      data: { revoked: true },
    });
    res.json({ message: "Logged out successfully" });
  } catch (e) {
    console.error("Logout error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /auth/me
router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.user!.userId },
      include: { settings: true },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      settings: user.settings,
    });
  } catch (e) {
    console.error("Me error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/change-password
router.post("/change-password", authMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    });
    const { currentPassword, newPassword } = schema.parse(req.body);

    const user = await prisma.user.findFirst({ where: { id: req.user!.userId } });
    if (!user || !user.passwordHash) {
      res.status(400).json({ error: "Cannot change password for OAuth accounts" });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    const { BCRYPT_ROUNDS } = getEnv();
    const newHash = await bcrypt.hash(newPassword, parseInt(BCRYPT_ROUNDS));
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    res.json({ message: "Password changed successfully" });
  } catch (e) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: e.issues });
      return;
    }
    console.error("Change password error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
