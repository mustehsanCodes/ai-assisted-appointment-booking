import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { createLogger } from "./infrastructure/logging/logger.js";
import type { Container } from "./container.js";
import type { Env } from "./config/env.js";

const env: Env = {
  NODE_ENV: "test",
  PORT: 4000,
  DATABASE_URL: "postgresql://unused",
  JWT_SECRET: "test-secret-that-is-longer-than-32-characters",
  JWT_EXPIRES_IN: "2h",
  ALLOWED_ORIGINS: ["http://localhost:3000"],
  GROQ_MODEL: "openai/gpt-oss-20b",
  AI_TIMEOUT_MS: 15000,
  BUSINESS_TIMEZONE: "Asia/Karachi",
};
const container = { logger: createLogger(false) } as Container;

describe("createApp", () => {
  it("serves liveness without opening a port", async () => {
    const result = await request(createApp(container, env)).get("/api/health");
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ status: "ok" });
  });
  it("returns the public error envelope for unknown routes", async () => {
    const result = await request(createApp(container, env)).get("/missing");
    expect(result.status).toBe(404);
    expect(result.body.error.code).toBe("NOT_FOUND");
    expect(result.body.error.requestId).toEqual(expect.any(String));
  });
});
