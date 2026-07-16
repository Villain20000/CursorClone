import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().default("3000"),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),
  BCRYPT_ROUNDS: z.string().default("10"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  OAUTH_GOOGLE_CLIENT_ID: z.string().optional(),
  OAUTH_GOOGLE_CLIENT_SECRET: z.string().optional(),
  OAUTH_GITHUB_CLIENT_ID: z.string().optional(),
  OAUTH_GITHUB_CLIENT_SECRET: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.string().default("900000"),
  RATE_LIMIT_MAX: z.string().default("100"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Environment validation failed:");
    console.error(result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n"));
    process.exit(1);
  }
  cached = result.data;
  return cached;
}
