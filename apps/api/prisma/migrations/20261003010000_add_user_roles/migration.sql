CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';
CREATE INDEX "User_role_createdAt_idx" ON "User"("role", "createdAt");
