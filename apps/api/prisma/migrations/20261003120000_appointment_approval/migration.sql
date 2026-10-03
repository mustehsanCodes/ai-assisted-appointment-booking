-- Drop status-dependent index before rewriting the enum.
DROP INDEX IF EXISTS "Appointment_confirmed_startsAt_key";

-- Rebuild appointment status enum with approval states.
CREATE TYPE "AppointmentStatus_new" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED');

ALTER TABLE "Appointment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Appointment"
  ALTER COLUMN "status" TYPE "AppointmentStatus_new"
  USING ("status"::text::"AppointmentStatus_new");

DROP TYPE "AppointmentStatus";
ALTER TYPE "AppointmentStatus_new" RENAME TO "AppointmentStatus";
ALTER TABLE "Appointment" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Active appointments (pending or confirmed) hold the slot.
CREATE UNIQUE INDEX "Appointment_active_startsAt_key"
  ON "Appointment"("startsAt")
  WHERE "status" IN ('PENDING', 'CONFIRMED');

CREATE INDEX IF NOT EXISTS "Appointment_status_startsAt_idx"
  ON "Appointment"("status", "startsAt");

-- Keep at most one future active appointment per user going forward:
-- cancel older duplicates, keep the soonest upcoming CONFIRMED/PENDING.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId"
      ORDER BY "startsAt" ASC, "createdAt" ASC
    ) AS rn
  FROM "Appointment"
  WHERE "status" IN ('PENDING', 'CONFIRMED')
    AND "startsAt" > CURRENT_TIMESTAMP
)
UPDATE "Appointment" a
SET "status" = 'CANCELLED', "updatedAt" = CURRENT_TIMESTAMP
FROM ranked r
WHERE a.id = r.id AND r.rn > 1;
