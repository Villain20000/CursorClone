import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../db/index.js";
import { getEnv } from "../config/index.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// Callback handler for OAuth providers
router.get("/callback", async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      res.redirect(`/login?error=${encodeURIComponent(error as string)}`);
      return;
    }

    let provider: "google" | "github";
    try {
      const decoded = JSON.parse(Buffer.from(state as string, "base64").toString());
      provider = decoded.provider;
    } catch {
      res.status(400).json({ error: "Invalid state parameter" });
      return;
    }

    const { CORS_ORIGIN } = getEnv();
    const redirectUri = `${CORS_ORIGIN.replace(/\/$/, "")}/auth/callback`;

    let email: string;
    let providerUserId: string;
    let displayName: string;

    if (provider === "google") {
      const { OAUTH_GOOGLE_CLIENT_ID, OAUTH_GOOGLE_CLIENT_SECRET } = getEnv();
      if (!OAUTH_GOOGLE_CLIENT_ID || !OAUTH_GOOGLE_CLIENT_SECRET) {
        res.status(501).json({ error: "Google OAuth not configured" });
        return;
      }

      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: OAUTH_GOOGLE_CLIENT_ID,
          client_secret: OAUTH_GOOGLE_CLIENT_SECRET,
          code: code as string,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }).toString(),
      });

      const tokenData = await tokenRes.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      };

      // Fetch user info
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userInfo = await userRes.json() as {
        id: string;
        email: string;
        name: string;
        picture?: string;
      };

      email = userInfo.email;
      providerUserId = userInfo.id;
      displayName = userInfo.name;

      // Upsert OAuth account
      let user = await prisma.user.findFirst({
        include: { oauthAccounts: true },
        where: { email },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            displayName,
            avatarUrl: userInfo.picture,
            username: email.split("@")[0],
            emailVerified: true,
          },
          include: { oauthAccounts: true },
        });
        await prisma.userSetting.create({ data: { userId: user.id } });
      }

      const existingAccount = user.oauthAccounts.find(
        (a) => a.provider === "GOOGLE" && a.providerUserId === providerUserId
      );

      if (existingAccount) {
        await prisma.oAuthAccount.update({
          where: { id: existingAccount.id },
          data: {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token || existingAccount.refreshToken,
            expiresAt: tokenData.expires_in
              ? new Date(Date.now() + tokenData.expires_in * 1000)
              : existingAccount.expiresAt,
          },
        });
      } else {
        await prisma.oAuthAccount.create({
          data: {
            userId: user.id,
            provider: "GOOGLE",
            providerUserId,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: tokenData.expires_in
              ? new Date(Date.now() + tokenData.expires_in * 1000)
              : null,
          },
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Generate tokens (same as login)
      const { JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY } = getEnv();
      const jwt = await import("jsonwebtoken");
      const accessToken = jwt.sign({ userId: user.id, role: user.role }, JWT_ACCESS_SECRET, {
        expiresIn: JWT_ACCESS_EXPIRY as jwt.SignOptions["expiresIn"],
      });
      const refreshTokenId = uuidv4();
      const refreshToken = jwt.sign({ id: refreshTokenId, userId: user.id }, JWT_REFRESH_SECRET, {
        expiresIn: JWT_REFRESH_EXPIRY as jwt.SignOptions["expiresIn"],
      });

      const expiresAt = new Date();
      const expirySeconds = parseInt(JWT_REFRESH_EXPIRY as string) || 7 * 24 * 60 * 60;
      expiresAt.setSeconds(expiresAt.getSeconds() + expirySeconds);

      await prisma.refreshToken.create({
        data: { id: refreshTokenId, token: refreshToken, userId: user.id, expiresAt },
      });
      await prisma.session.create({
        data: { userId: user.id, userAgent: req.headers["user-agent"], ipAddress: req.ip, expiresAt },
      });

      // Redirect to frontend with tokens in URL (frontend extracts them)
      const resultUrl = new URL(`${CORS_ORIGIN}/auth/callback`);
      resultUrl.searchParams.set("access_token", accessToken);
      resultUrl.searchParams.set("refresh_token", refreshToken);
      res.redirect(resultUrl.toString());

    } else if (provider === "github") {
      const { OAUTH_GITHUB_CLIENT_ID, OAUTH_GITHUB_CLIENT_SECRET } = getEnv();
      if (!OAUTH_GITHUB_CLIENT_ID || !OAUTH_GITHUB_CLIENT_SECRET) {
        res.status(501).json({ error: "GitHub OAuth not configured" });
        return;
      }

      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: OAUTH_GITHUB_CLIENT_ID,
          client_secret: OAUTH_GITHUB_CLIENT_SECRET,
          code: code as string,
          redirect_uri: redirectUri,
        }),
      });
      const tokenData = await tokenRes.json() as { access_token: string };

      const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `token ${tokenData.access_token}` },
      });
      const ghUser = await userRes.json() as {
        id: number;
        login: string;
        name: string;
        email?: string;
        avatar_url?: string;
      };

      providerUserId = String(ghUser.id);
      displayName = ghUser.name || ghUser.login;

      email = ghUser.email || "";
      if (!email) {
        // Fetch primary email
        const emailsRes = await fetch("https://api.github.com/user/emails", {
          headers: { Authorization: `token ${tokenData.access_token}` },
        });
        const emails = await emailsRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
        const primary = emails.find((e) => e.primary && e.verified);
        email = primary?.email || `${ghUser.login}@users.noreply.github.com`;
      }

      let user = await prisma.user.findFirst({
        include: { oauthAccounts: true },
        where: { email },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            displayName,
            avatarUrl: ghUser.avatar_url,
            username: ghUser.login,
            emailVerified: true,
          },
          include: { oauthAccounts: true },
        });
        await prisma.userSetting.create({ data: { userId: user.id } });
      }

      const existingAccount = user.oauthAccounts.find(
        (a) => a.provider === "GITHUB" && a.providerUserId === providerUserId
      );

      if (existingAccount) {
        await prisma.oAuthAccount.update({
          where: { id: existingAccount.id },
          data: { accessToken: tokenData.access_token },
        });
      } else {
        await prisma.oAuthAccount.create({
          data: {
            userId: user.id,
            provider: "GITHUB",
            providerUserId,
            accessToken: tokenData.access_token,
          },
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const { JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY } = getEnv();
      const jwt = await import("jsonwebtoken");
      const accessToken = jwt.sign({ userId: user.id, role: user.role }, JWT_ACCESS_SECRET, {
        expiresIn: JWT_ACCESS_EXPIRY as jwt.SignOptions["expiresIn"],
      });
      const refreshTokenId = uuidv4();
      const refreshToken = jwt.sign({ id: refreshTokenId, userId: user.id }, JWT_REFRESH_SECRET, {
        expiresIn: JWT_REFRESH_EXPIRY as jwt.SignOptions["expiresIn"],
      });

      const expiresAt = new Date();
      const expirySeconds = parseInt(JWT_REFRESH_EXPIRY as string) || 7 * 24 * 60 * 60;
      expiresAt.setSeconds(expiresAt.getSeconds() + expirySeconds);

      await prisma.refreshToken.create({
        data: { id: refreshTokenId, token: refreshToken, userId: user.id, expiresAt },
      });
      await prisma.session.create({
        data: { userId: user.id, userAgent: req.headers["user-agent"], ipAddress: req.ip, expiresAt },
      });

      const resultUrl = new URL(`${CORS_ORIGIN}/auth/callback`);
      resultUrl.searchParams.set("access_token", accessToken);
      resultUrl.searchParams.set("refresh_token", refreshToken);
      res.redirect(resultUrl.toString());
    } else {
      res.status(400).json({ error: "Unknown OAuth provider" });
    }
  } catch (e) {
    console.error("OAuth callback error:", e);
    res.status(500).json({ error: "OAuth callback failed" });
  }
});

export default router;
