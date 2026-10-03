import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Env } from "./config/env.js";
import type { Container } from "./container.js";
import { AppError } from "./errors/app-error.js";
import { validate } from "./middleware/validate.middleware.js";
import { signupSchema, loginSchema } from "./modules/auth/auth.schemas.js";
const appointmentInput = z
    .object({
      serviceCode: z.literal("CONSULTATION_30"),
      startsAt: z.string().datetime({ offset: true }),
      idempotencyKey: z.string().min(8).max(100),
    })
    .strict(),
  rescheduleInput = z
    .object({ startsAt: z.string().datetime({ offset: true }) })
    .strict(),
  dateQuery = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  idParam = z.object({ id: z.string().uuid() }),
  messageInput = z
    .object({ content: z.string().trim().min(1).max(2000), clientMessageId: z.string().uuid() })
    .strict();
export function createApp(c: Container, env: Env) {
  const app = express();
  app.set("trust proxy", 1);
  app.use((req, _res, next) => {
    req.requestId =
      (req.headers["x-request-id"] as string | undefined)?.slice(0, 100) ?? randomUUID();
    next();
  });
  app.use(
    pinoHttp({
      logger: c.logger,
      customProps: (req) => ({ requestId: (req as express.Request).requestId }),
      redact: ["req.headers.cookie", "res.headers.set-cookie"],
    }),
  );
  app.use(helmet());
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  app.use((req, _res, next) => {
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
      req.headers.origin &&
      !env.ALLOWED_ORIGINS.includes(req.headers.origin)
    )
      return next(new AppError(403, "UNTRUSTED_ORIGIN", "Request origin is not allowed."));
    next();
  });
  app.use(
    rateLimit({ windowMs: 60000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false }),
  );
  const cookie = (res: express.Response, token: string) =>
    res.cookie("session", token, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 2 * 3600000,
    });
  const requireAuth: express.RequestHandler = async (req, _res, next) => {
    const token = req.cookies.session as string | undefined;
    if (!token) throw new AppError(401, "UNAUTHENTICATED", "Please sign in.");
    const user = await c.auth.getUser(await c.auth.verify(token));
    req.auth = { userId: user.id, role: user.role };
    next();
  };
  const requireAdmin: express.RequestHandler = (req, _res, next) => {
    if (req.auth?.role !== "ADMIN")
      throw new AppError(403, "FORBIDDEN", "Administrator access is required.");
    next();
  };
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/health/ready", async (_req, res) => {
    await c.db.$queryRaw`SELECT 1`;
    res.json({ status: "ready" });
  });
  app.post(
    "/api/auth/signup",
    rateLimit({ windowMs: 60000, limit: 10 }),
    validate("body", signupSchema),
    async (req, res) => {
      const r = await c.auth.signup(req.validated!.body as never);
      cookie(res, r.token).status(201).json({ user: r.user });
    },
  );
  app.post(
    "/api/auth/login",
    rateLimit({ windowMs: 60000, limit: 10 }),
    validate("body", loginSchema),
    async (req, res) => {
      const r = await c.auth.login(req.validated!.body as never);
      cookie(res, r.token).json({ user: r.user });
    },
  );
  app.post("/api/auth/logout", (_req, res) => {
    res
      .clearCookie("session", {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      })
      .json({ ok: true });
  });
  app.get("/api/auth/me", requireAuth, async (req, res) =>
    res.json({ user: await c.auth.getUser(req.auth!.userId) }),
  );
  app.get(
    "/api/appointments/availability",
    requireAuth,
    validate("query", dateQuery),
    async (req, res) =>
      res.json({
        slots: await c.appointments.availability((req.validated!.query as { date: string }).date),
      }),
  );
  app.post(
    "/api/appointments",
    requireAuth,
    validate("body", appointmentInput),
    async (req, res) => {
      const r = await c.appointments.create(req.auth!.userId, req.validated!.body as never);
      res.status(r.replayed ? 200 : 201).json(r);
    },
  );
  app.get("/api/appointments", requireAuth, async (req, res) =>
    res.json({ appointments: await c.appointments.list(req.auth!.userId) }),
  );
  app.get("/api/appointments/:id", requireAuth, validate("params", idParam), async (req, res) =>
    res.json({
      appointment: await c.appointments.get(
        req.auth!.userId,
        (req.validated!.params as { id: string }).id,
      ),
    }),
  );
  app.post(
    "/api/appointments/:id/cancel",
    requireAuth,
    validate("params", idParam),
    async (req, res) =>
      res.json({
        appointment: await c.appointments.cancelOwn(
          req.auth!.userId,
          (req.validated!.params as { id: string }).id,
        ),
      }),
  );
  app.post(
    "/api/appointments/:id/reschedule",
    requireAuth,
    validate("params", idParam),
    validate("body", rescheduleInput),
    async (req, res) =>
      res.json({
        appointment: await c.appointments.rescheduleOwn(
          req.auth!.userId,
          (req.validated!.params as { id: string }).id,
          (req.validated!.body as { startsAt: string }).startsAt,
        ),
      }),
  );
  app.post("/api/chat/sessions", requireAuth, async (req, res) =>
    res.status(201).json({ session: await c.chat.create(req.auth!.userId) }),
  );
  app.get("/api/chat/sessions", requireAuth, async (req, res) =>
    res.json({ sessions: await c.chat.list(req.auth!.userId) }),
  );
  app.get("/api/chat/sessions/:id", requireAuth, validate("params", idParam), async (req, res) =>
    res.json({
      session: await c.chat.get(req.auth!.userId, (req.validated!.params as { id: string }).id),
    }),
  );
  app.get(
    "/api/chat/sessions/:id/messages",
    requireAuth,
    validate("params", idParam),
    async (req, res) =>
      res.json({
        messages: await c.chat.messages(
          req.auth!.userId,
          (req.validated!.params as { id: string }).id,
        ),
      }),
  );
  app.post(
    "/api/chat/sessions/:id/messages",
    requireAuth,
    validate("params", idParam),
    validate("body", messageInput),
    async (req, res) =>
      res.json(
        await c.chat.send(
          req.auth!.userId,
          (req.validated!.params as { id: string }).id,
          req.validated!.body as never,
        ),
      ),
  );
  app.get("/api/admin/overview", requireAuth, requireAdmin, async (_req, res) => {
    res.json(await c.appointments.overview());
  });
  app.post(
    "/api/admin/appointments/:id/approve",
    requireAuth,
    requireAdmin,
    validate("params", idParam),
    async (req, res) =>
      res.json({
        appointment: await c.appointments.adminApprove(
          (req.validated!.params as { id: string }).id,
        ),
      }),
  );
  app.post(
    "/api/admin/appointments/:id/reject",
    requireAuth,
    requireAdmin,
    validate("params", idParam),
    async (req, res) =>
      res.json({
        appointment: await c.appointments.adminReject((req.validated!.params as { id: string }).id),
      }),
  );
  app.post(
    "/api/admin/appointments/:id/cancel",
    requireAuth,
    requireAdmin,
    validate("params", idParam),
    async (req, res) =>
      res.json({
        appointment: await c.appointments.adminCancel((req.validated!.params as { id: string }).id),
      }),
  );
  app.post(
    "/api/admin/appointments/:id/reschedule",
    requireAuth,
    requireAdmin,
    validate("params", idParam),
    validate("body", rescheduleInput),
    async (req, res) =>
      res.json({
        appointment: await c.appointments.adminReschedule(
          (req.validated!.params as { id: string }).id,
          (req.validated!.body as { startsAt: string }).startsAt,
        ),
      }),
  );
  app.use((_req, _res, next) => next(new AppError(404, "NOT_FOUND", "Route not found.")));
  app.use(
    (err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const e =
        err instanceof AppError
          ? err
          : new AppError(500, "INTERNAL_ERROR", "Something went wrong.");
      if (!(err instanceof AppError))
        c.logger.error({ err, requestId: req.requestId }, "Unexpected error");
      res.status(e.status).json({
        error: {
          code: e.code,
          message: e.message,
          ...(e.fieldErrors ? { fieldErrors: e.fieldErrors } : {}),
          requestId: req.requestId,
        },
      });
    },
  );
  return app;
}
