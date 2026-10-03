import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const passwordHash = await bcrypt.hash("DemoPassword123!", 12);

await db.user.upsert({
  where: { email: "demo@example.com" },
  update: { role: "USER" },
  create: { name: "Demo User", email: "demo@example.com", passwordHash, role: "USER" },
});

await db.user.upsert({
  where: { email: "admin@example.com" },
  update: { role: "ADMIN" },
  create: { name: "Admin User", email: "admin@example.com", passwordHash, role: "ADMIN" },
});

await db.$disconnect();
