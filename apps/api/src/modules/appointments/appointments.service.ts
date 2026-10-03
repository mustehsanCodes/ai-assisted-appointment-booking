import { createHash } from "node:crypto";
import { AppointmentStatus, type Appointment, type PrismaClient } from "@prisma/client";
import { AppError } from "../../errors/app-error.js";
import type { Logger } from "../../infrastructure/logging/logger.js";
import { SERVICE_CODE, slotsForDate, validateBooking } from "./booking-policy.js";

const ACTIVE: AppointmentStatus[] = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED];

export class AppointmentsService {
  constructor(
    private db: PrismaClient,
    private logger: Logger,
  ) {}

  private async assertNoActiveDuplicate(userId: string, now: Date, exceptId?: string) {
    const existing = await this.db.appointment.findFirst({
      where: {
        userId,
        status: { in: ACTIVE },
        startsAt: { gt: now },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      orderBy: { startsAt: "asc" },
    });
    if (existing) {
      throw new AppError(
        409,
        "DUPLICATE_ACTIVE_APPOINTMENT",
        existing.status === AppointmentStatus.PENDING
          ? "You already have a pending appointment awaiting admin approval. Cancel or wait for a decision before booking another."
          : "You already have a confirmed upcoming appointment. Cancel it with support/admin before booking another.",
      );
    }
  }

  async availability(date: string, now = new Date()) {
    const slots = slotsForDate(date, now);
    if (!slots.length) return [];
    const booked = await this.db.appointment.findMany({
      where: { startsAt: { in: slots }, status: { in: ACTIVE } },
      select: { startsAt: true },
    });
    const taken = new Set(booked.map((x) => x.startsAt.toISOString()));
    return slots.filter((x) => !taken.has(x.toISOString())).map((x) => x.toISOString());
  }

  async create(
    userId: string,
    input: { serviceCode: string; startsAt: string; idempotencyKey: string },
    now = new Date(),
  ) {
    if (input.serviceCode !== SERVICE_CODE)
      throw new AppError(400, "UNSUPPORTED_SERVICE", "Unsupported service.");
    const start = new Date(input.startsAt),
      end = validateBooking(start, now),
      hash = createHash("sha256").update(`${SERVICE_CODE}|${start.toISOString()}`).digest("hex");
    const old = await this.db.appointment.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
    });
    if (old) {
      if (old.requestHash !== hash)
        throw new AppError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "This key was already used for another request.",
        );
      return { appointment: old, replayed: true };
    }
    await this.assertNoActiveDuplicate(userId, now);
    try {
      const appointment = await this.db.appointment.create({
        data: {
          userId,
          serviceCode: SERVICE_CODE,
          startsAt: start,
          endsAt: end,
          status: AppointmentStatus.PENDING,
          idempotencyKey: input.idempotencyKey,
          requestHash: hash,
        },
      });
      this.logger.info(
        { appointmentId: appointment.id, event: "appointment_requested" },
        "Appointment requested (pending approval)",
      );
      return { appointment, replayed: false };
    } catch (e) {
      if ((e as { code?: string }).code === "P2002")
        throw new AppError(409, "SLOT_UNAVAILABLE", "This slot is no longer available.");
      throw e;
    }
  }

  list(userId: string) {
    return this.db.appointment.findMany({
      where: { userId },
      orderBy: { startsAt: "asc" },
      take: 50,
    });
  }

  async get(userId: string, id: string) {
    const a = await this.db.appointment.findFirst({ where: { id, userId } });
    if (!a) throw new AppError(404, "NOT_FOUND", "Appointment not found.");
    return a;
  }

  async cancelOwn(userId: string, id: string, now = new Date()) {
    const a = await this.get(userId, id);
    if (a.status !== AppointmentStatus.PENDING)
      throw new AppError(
        409,
        "CANNOT_CHANGE",
        "Only pending appointments can be cancelled by you. Confirmed bookings need an administrator.",
      );
    if (a.startsAt <= now)
      throw new AppError(409, "CANNOT_CHANGE", "Past appointments cannot be changed.");
    return this.db.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CANCELLED },
    });
  }

  async rescheduleOwn(userId: string, id: string, startsAt: string, now = new Date()) {
    const a = await this.get(userId, id);
    if (a.status !== AppointmentStatus.PENDING)
      throw new AppError(
        409,
        "CANNOT_CHANGE",
        "Only pending appointments can be rescheduled by you. Ask an administrator after approval.",
      );
    if (a.startsAt <= now)
      throw new AppError(409, "CANNOT_CHANGE", "Past appointments cannot be changed.");
    const start = new Date(startsAt),
      end = validateBooking(start, now);
    try {
      return await this.db.appointment.update({
        where: { id },
        data: {
          startsAt: start,
          endsAt: end,
          requestHash: createHash("sha256")
            .update(`${SERVICE_CODE}|${start.toISOString()}`)
            .digest("hex"),
        },
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002")
        throw new AppError(409, "SLOT_UNAVAILABLE", "This slot is no longer available.");
      throw e;
    }
  }

  private async getAny(id: string) {
    const a = await this.db.appointment.findUnique({ where: { id } });
    if (!a) throw new AppError(404, "NOT_FOUND", "Appointment not found.");
    return a;
  }

  async adminApprove(id: string, now = new Date()) {
    const a = await this.getAny(id);
    if (a.status !== AppointmentStatus.PENDING)
      throw new AppError(409, "CANNOT_CHANGE", "Only pending appointments can be approved.");
    if (a.startsAt <= now)
      throw new AppError(409, "CANNOT_CHANGE", "Cannot approve a past slot.");
    await this.assertNoActiveDuplicate(a.userId, now, a.id);
    const updated = await this.db.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CONFIRMED },
    });
    this.logger.info({ appointmentId: id, event: "appointment_approved" }, "Appointment approved");
    return updated;
  }

  async adminReject(id: string) {
    const a = await this.getAny(id);
    if (a.status !== AppointmentStatus.PENDING)
      throw new AppError(409, "CANNOT_CHANGE", "Only pending appointments can be rejected.");
    const updated = await this.db.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.REJECTED },
    });
    this.logger.info({ appointmentId: id, event: "appointment_rejected" }, "Appointment rejected");
    return updated;
  }

  async adminCancel(id: string) {
    const a = await this.getAny(id);
    if (!ACTIVE.includes(a.status))
      throw new AppError(
        409,
        "CANNOT_CHANGE",
        "Only pending or confirmed appointments can be cancelled.",
      );
    return this.db.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CANCELLED },
    });
  }

  async adminReschedule(id: string, startsAt: string, now = new Date()) {
    const a = await this.getAny(id);
    if (!ACTIVE.includes(a.status))
      throw new AppError(
        409,
        "CANNOT_CHANGE",
        "Only pending or confirmed appointments can be rescheduled.",
      );
    if (a.startsAt <= now && a.status === AppointmentStatus.CONFIRMED)
      throw new AppError(409, "CANNOT_CHANGE", "Past confirmed appointments cannot be rescheduled.");
    const start = new Date(startsAt),
      end = validateBooking(start, now);
    try {
      return await this.db.appointment.update({
        where: { id },
        data: {
          startsAt: start,
          endsAt: end,
          requestHash: createHash("sha256")
            .update(`${SERVICE_CODE}|${start.toISOString()}`)
            .digest("hex"),
        },
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002")
        throw new AppError(409, "SLOT_UNAVAILABLE", "This slot is no longer available.");
      throw e;
    }
  }

  overview() {
    return Promise.all([
      this.db.user.findMany({
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      this.db.appointment.findMany({
        include: { user: { select: { name: true, email: true } } },
        orderBy: [{ startsAt: "desc" }],
        take: 100,
      }),
    ]).then(([users, appointments]) => ({ users, appointments }));
  }
}

export type AppointmentRecord = Appointment;
