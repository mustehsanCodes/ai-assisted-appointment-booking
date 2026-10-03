import { PrismaClient } from "@prisma/client";
import type { Env } from "./config/env.js";
import { createLogger } from "./infrastructure/logging/logger.js";
import { GroqProvider } from "./infrastructure/ai/groq.provider.js";
import type { AiProvider } from "./modules/ai/ai.types.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { AppointmentsService } from "./modules/appointments/appointments.service.js";
import { ChatService } from "./modules/chat/chat.service.js";
export function createContainer(
  env: Env,
  overrides?: { db?: PrismaClient; ai?: AiProvider | null },
) {
  const db = overrides?.db ?? new PrismaClient(),
    logger = createLogger(env.NODE_ENV === "production", env.LOG_FILE),
    ai =
      overrides && "ai" in overrides
        ? overrides.ai
        : env.GROQ_API_KEY
          ? new GroqProvider(env.GROQ_API_KEY, env.GROQ_MODEL, env.AI_TIMEOUT_MS)
          : null;
  const appointments = new AppointmentsService(db, logger);
  return {
    db,
    logger,
    auth: new AuthService(db, env.JWT_SECRET, logger),
    appointments,
    chat: new ChatService(db, ai, appointments, logger),
  };
}
export type Container = ReturnType<typeof createContainer>;
