import { AppError } from "../../errors/app-error.js";
export const SERVICE_CODE = "CONSULTATION_30";
export function validateBooking(startsAt: Date, now = new Date()): Date {
  if (Number.isNaN(startsAt.valueOf()))
    throw new AppError(400, "INVALID_SLOT", "Invalid timestamp.");
  if (startsAt <= now) throw new AppError(400, "INVALID_SLOT", "Choose a future slot.");
  if (startsAt > new Date(now.getTime() + 30 * 86400000))
    throw new AppError(400, "INVALID_SLOT", "Bookings are limited to 30 days.");
  const local = new Date(startsAt.getTime() + 5 * 3600000),
    day = local.getUTCDay(),
    hour = local.getUTCHours(),
    minute = local.getUTCMinutes();
  if (
    day === 0 ||
    day === 6 ||
    minute % 30 !== 0 ||
    local.getUTCSeconds() !== 0 ||
    hour < 9 ||
    (hour === 16 && minute > 30) ||
    hour >= 17
  )
    throw new AppError(
      400,
      "INVALID_SLOT",
      "Choose an aligned weekday slot between 09:00 and 17:00 Islamabad (PKT).",
    );
  return new Date(startsAt.getTime() + 30 * 60000);
}
export function slotsForDate(date: string, now = new Date()): Date[] {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) throw new AppError(400, "INVALID_DATE", "Use YYYY-MM-DD.");
  const base = new Date(Date.UTC(y, m - 1, d, 4));
  if (
    base.toISOString().slice(0, 10) !== new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10)
  )
    throw new AppError(400, "INVALID_DATE", "Invalid date.");
  return Array.from({ length: 16 }, (_, i) => new Date(base.getTime() + i * 30 * 60000)).filter(
    (x) => {
      try {
        validateBooking(x, now);
        return true;
      } catch {
        return false;
      }
    },
  );
}
