import { randomUUID } from "node:crypto";
import type { PrismaClient, Prisma } from "@prisma/client";
import type { AiProvider } from "../ai/ai.types.js";
import type { AppointmentsService } from "../appointments/appointments.service.js";
import { AppError } from "../../errors/app-error.js";
import type { Logger } from "../../infrastructure/logging/logger.js";

function islamabadClock(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Karachi",
  }).format(new Date(iso));
}

function islamabadDate(isoOrDate: string) {
  const value = /^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)
    ? `${isoOrDate}T12:00:00.000Z`
    : isoOrDate;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function clipTitle(text: string, max = 52) {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return "";
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function titleFromMessage(content: string) {
  const text = content.trim().replace(/\s+/g, " ");
  const lower = text.toLowerCase();
  if (/available|slot|timing|time|date/.test(lower) && /islamabad|pkt|appointment|book/.test(lower))
    return clipTitle("Available slots in Islamabad");
  if (/available|slot/.test(lower)) return clipTitle("Checking available slots");
  if (/book|booking|schedule|appoint/.test(lower)) return clipTitle("Booking consultation");
  if (/confirm|final|proceed|yes/.test(lower)) return clipTitle("Confirming draft details");
  return clipTitle(text) || "New conversation";
}

function draftSubtitle(draft: unknown) {
  if (!draft || typeof draft !== "object") return null;
  const d = draft as { date?: string; time?: string };
  if (d.date && d.time) return `Draft · ${d.date} at ${d.time} PKT`;
  if (d.date) return `Draft · ${d.date}`;
  if (d.time) return `Draft · ${d.time} PKT`;
  return null;
}

export class ChatService {
  constructor(
    private db: PrismaClient,
    private ai: AiProvider | null,
    private appointments: AppointmentsService,
    private logger: Logger,
  ) {}
  create(userId: string) {
    return this.db.chatSession.create({ data: { userId } });
  }
  async list(userId: string) {
    const sessions = await this.db.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: {
        messages: {
          where: { role: "USER" },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { content: true },
        },
      },
    });
    return sessions.map((session) => {
      const first = session.messages[0]?.content;
      const subtitle = draftSubtitle(session.bookingDraft);
      return {
        id: session.id,
        bookingDraft: session.bookingDraft,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        title: first ? titleFromMessage(first) : subtitle ?? "New conversation",
        subtitle,
      };
    });
  }
  async get(userId: string, id: string) {
    const s = await this.db.chatSession.findFirst({ where: { id, userId } });
    if (!s) throw new AppError(404, "NOT_FOUND", "Chat session not found.");
    return s;
  }
  async messages(userId: string, id: string) {
    await this.get(userId, id);
    return this.db.chatMessage.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
  }

  private async buildAvailabilityHint(preferredDate?: string | null) {
    const lines: string[] = [];
    const now = new Date();
    const dates: string[] = [];
    if (preferredDate) dates.push(preferredDate);
    for (let i = 0; i < 10 && dates.length < 4; i++) {
      const d = new Date(now.getTime() + i * 86400000);
      const key = islamabadDate(d.toISOString());
      if (!dates.includes(key)) dates.push(key);
    }
    for (const date of dates) {
      try {
        const slots = await this.appointments.availability(date, now);
        if (!slots.length) continue;
        const times = slots.slice(0, 8).map(islamabadClock);
        lines.push(`${date}: ${times.join(", ")}${slots.length > 8 ? ", …" : ""}`);
        if (lines.length >= 3) break;
      } catch {
        /* skip invalid/weekend dates */
      }
    }
    if (!lines.length) return "No open weekday slots in the next few days.";
    return `Islamabad (PKT) open slots — ${lines.join(" | ")}`;
  }

  private sanitizeReply(reply: string, draft: { date?: string; time?: string }) {
    let text = reply
      .replace(/\b(I've|I have|we have)\s+(scheduled|booked|confirmed|approved)\b/gi, "I've noted")
      .replace(/\b(is|was)\s+(scheduled|booked|confirmed|approved)\b/gi, "is drafted")
      .replace(/\byour consultation is tentatively scheduled\b/gi, "your draft preference is noted")
      .replace(/\bfinal(ly)?\s+booked\b/gi, "saved as a draft");
    if (draft.date && draft.time) {
      text = `${text.trim()} This is only a draft (${draft.date} ${draft.time} PKT). Submit it in Manual Booking — status will be PENDING until an admin approves. Chat cannot confirm appointments.`;
    } else if (!/manual booking|PENDING|admin/i.test(text)) {
      text = `${text.trim()} Chat never confirms a booking — use Manual Booking when ready.`;
    }
    return text;
  }

  private enrichReply(reply: string, hint: string, draft: { date?: string; time?: string }) {
    let text = this.sanitizeReply(reply, draft);
    if (!/\d{1,2}:\d{2}/.test(text) && hint && !hint.startsWith("No open")) {
      text = `${text.trim()} ${hint}`;
    }
    return text;
  }

  async send(userId: string, id: string, input: { content: string; clientMessageId: string }) {
    const session = await this.get(userId, id),
      existing = await this.db.chatMessage.findFirst({
        where: { sessionId: id, clientMessageId: input.clientMessageId },
      });
    if (existing) {
      return { messages: await this.messages(userId, id), deduplicated: true };
    }
    const token = randomUUID(),
      expiry = new Date(Date.now() - 30000);
    const claimed = await this.db.chatSession.updateMany({
      where: { id, OR: [{ processingToken: null }, { processingStartedAt: { lt: expiry } }] },
      data: { processingToken: token, processingStartedAt: new Date() },
    });
    if (!claimed.count) throw new AppError(409, "CHAT_BUSY", "Please wait for the current reply.");
    const userMessage = await this.db.chatMessage.create({
      data: {
        sessionId: id,
        role: "USER",
        content: input.content,
        clientMessageId: input.clientMessageId,
        aiStatus: "PENDING",
      },
    });
    try {
      if (!this.ai) throw new Error("manual mode");
      const draft = (session.bookingDraft ?? {}) as { date?: string; time?: string };
      const availabilityHint = await this.buildAvailabilityHint(draft.date ?? null);
      const out = await this.ai.extract({
        message: input.content,
        draft: session.bookingDraft,
        now: new Date().toISOString(),
        availabilityHint,
      });
      const nextDraft = {
        ...draft,
        ...(out.date ? { date: out.date } : {}),
        ...(out.time ? { time: out.time } : {}),
      };
      const datedHint = out.date
        ? await this.buildAvailabilityHint(out.date)
        : availabilityHint;
      const content = this.enrichReply(out.reply, datedHint, nextDraft);
      await this.db.$transaction([
        this.db.chatMessage.update({
          where: { id: userMessage.id },
          data: { aiStatus: "COMPLETED" },
        }),
        this.db.chatMessage.create({
          data: {
            sessionId: id,
            role: "ASSISTANT",
            content,
            replyToMessageId: userMessage.id,
            aiStatus: "COMPLETED",
          },
        }),
        this.db.chatSession.update({
          where: { id },
          data: {
            bookingDraft: nextDraft as Prisma.InputJsonValue,
            processingToken: null,
            processingStartedAt: null,
          },
        }),
      ]);
      this.logger.info(
        { event: "ai_extraction_completed", sessionId: id },
        "AI extraction completed",
      );
    } catch (error) {
      this.logger.warn(
        {
          event: "ai_extraction_failed",
          sessionId: id,
          errorType: error instanceof Error ? error.name : "unknown",
        },
        "AI unavailable",
      );
      const hint = await this.buildAvailabilityHint(null).catch(() => "");
      await this.db.$transaction([
        this.db.chatMessage.update({ where: { id: userMessage.id }, data: { aiStatus: "FAILED" } }),
        this.db.chatMessage.create({
          data: {
            sessionId: id,
            role: "ASSISTANT",
            content: hint
              ? `I couldn’t interpret that safely. ${hint}. Please confirm in the manual booking form.`
              : "I couldn’t process that safely. Please use the manual booking form.",
            replyToMessageId: userMessage.id,
            aiStatus: "FAILED",
          },
        }),
        this.db.chatSession.update({
          where: { id },
          data: { processingToken: null, processingStartedAt: null },
        }),
      ]);
    }
    return { messages: await this.messages(userId, id), deduplicated: false };
  }
}
