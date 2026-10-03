import { describe, it, expect } from "vitest";
import { validateBooking, slotsForDate } from "./booking-policy.js";
describe("booking policy", () => {
  const now = new Date("2026-10-01T00:00:00Z");
  it("accepts a weekday aligned Islamabad (PKT) slot", () =>
    expect(validateBooking(new Date("2026-10-05T04:00:00Z"), now).toISOString()).toBe(
      "2026-10-05T04:30:00.000Z",
    ));
  it("rejects weekends and misalignment", () => {
    expect(() => validateBooking(new Date("2026-10-04T04:00:00Z"), now)).toThrow();
    expect(() => validateBooking(new Date("2026-10-05T04:10:00Z"), now)).toThrow();
  });
  it("creates 16 business slots", () => expect(slotsForDate("2026-10-05", now)).toHaveLength(16));
});
