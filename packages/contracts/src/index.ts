import { z } from "zod";

export const authUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["USER", "ADMIN"]),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const appointmentStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "REJECTED",
  "CANCELLED",
]);
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

export const appointmentSchema = z.object({
  id: z.string().uuid(),
  serviceCode: z.literal("CONSULTATION_30"),
  startsAt: z.string(),
  endsAt: z.string(),
  status: appointmentStatusSchema,
  createdAt: z.string(),
});
export type Appointment = z.infer<typeof appointmentSchema>;

export const chatMessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["USER", "ASSISTANT"]),
  content: z.string(),
  aiStatus: z.enum(["PENDING", "COMPLETED", "FAILED"]),
  createdAt: z.string(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatSessionSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  subtitle: z.string().nullable().optional(),
  bookingDraft: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ChatSession = z.infer<typeof chatSessionSchema>;

export type AdminOverview = {
  users: Array<AuthUser & { createdAt: string }>;
  appointments: Array<Appointment & { user: { name: string; email: string } }>;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
    requestId: string;
  };
};
