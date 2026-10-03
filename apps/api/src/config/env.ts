import { z } from "zod";
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("2h"),
  ALLOWED_ORIGINS: z.string().transform((v) => v.split(",").map((x) => x.trim())),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("openai/gpt-oss-20b"),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(15000),
  BUSINESS_TIMEZONE: z.literal("Asia/Karachi").default("Asia/Karachi"),
  LOG_FILE: z.string().min(1).optional(),
});
export type Env = z.infer<typeof schema>;
export const loadEnv = (source: NodeJS.ProcessEnv = process.env) => schema.parse(source);
