import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import pino from "pino";

const options = (production: boolean) => ({
  level: production ? "info" : "debug",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers.set-cookie",
      "password",
      "passwordHash",
      "JWT_SECRET",
      "GROQ_API_KEY",
      "DATABASE_URL",
      "DIRECT_URL",
    ],
    censor: "[REDACTED]",
  },
});

export function createLogger(production = false, logFile?: string) {
  if (!logFile) return pino(options(production));
  const path = resolve(logFile);
  mkdirSync(dirname(path), { recursive: true });
  return pino(
    options(production),
    pino.multistream([
      { stream: process.stdout },
      { stream: pino.destination({ dest: path, mkdir: true, sync: false }) },
    ]),
  );
}
export type Logger = ReturnType<typeof createLogger>;
