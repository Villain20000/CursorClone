import { Router, Request, Response } from "express";
import { getEnv } from "../config/index.js";

const router = Router();

// GET /auth/oauth/google — initiate Google OAuth
router.get("/google", (req: Request, res: Response) => {
  const { OAUTH_GOOGLE_CLIENT_ID } = getEnv();
  if (!OAUTH_GOOGLE_CLIENT_ID) {
    res.status(501).json({ error: "Google OAuth not configured" });
    return;
  }

  const redirectUri = `${getEnv().CORS_ORIGIN.replace(/\/$/, "")}/auth/callback`;
  const state = Buffer.from(JSON.stringify({ provider: "google" })).toString("base64");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", OAUTH_GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");

  res.redirect(url.toString());
});

// GET /auth/oauth/github — initiate GitHub OAuth
router.get("/github", (req: Request, res: Response) => {
  const { OAUTH_GITHUB_CLIENT_ID } = getEnv();
  if (!OAUTH_GITHUB_CLIENT_ID) {
    res.status(501).json({ error: "GitHub OAuth not configured" });
    return;
  }

  const state = Buffer.from(JSON.stringify({ provider: "github" })).toString("base64");
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", OAUTH_GITHUB_CLIENT_ID);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", state);

  res.redirect(url.toString());
});

export default router;
