import "dotenv/config";
import express from "express";
import { createServer } from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { getEnv } from "./config/index.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import projectRoutes from "./routes/projects.js";
import fileRoutes from "./routes/files.js";
import settingsRoutes from "./routes/settings.js";
import aiRoutes from "./routes/ai.js";
import apiKeysRoutes from "./routes/apikeys.js";
import oauthRoutes from "./routes/oauth.js";
import oauthCallbackRoutes from "./routes/oauthCallback.js";
import { setupWebSocket } from "./websocket/index.js";

const app = express();
const server = createServer(app);
const { PORT, CORS_ORIGIN, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX } = getEnv();

// ─── Middleware ─────────────────────────────────────────────────────
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(RATE_LIMIT_WINDOW_MS),
  max: parseInt(RATE_LIMIT_MAX),
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

// ─── Health check ───────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Routes ─────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/auth/oauth", oauthRoutes);
app.use("/api/auth/oauth", oauthCallbackRoutes);
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/api-keys", apiKeysRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ─── WebSocket ──────────────────────────────────────────────────────
setupWebSocket(server);

// ─── Start ──────────────────────────────────────────────────────────
server.listen(parseInt(PORT), () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS origin: ${CORS_ORIGIN}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
});

export default app;
