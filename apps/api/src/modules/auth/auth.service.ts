import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { PrismaClient } from "@prisma/client";
import { AppError } from "../../errors/app-error.js";
import type { Logger } from "../../infrastructure/logging/logger.js";
export class AuthService {
  private key: Uint8Array;
  constructor(
    private db: PrismaClient,
    secret: string,
    private logger: Logger,
  ) {
    this.key = new TextEncoder().encode(secret);
  }
  async signup(input: { name: string; email: string; password: string }) {
    try {
      const user = await this.db.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash: await bcrypt.hash(input.password, 12),
        },
      });
      return { user: this.public(user), token: await this.token(user.id) };
    } catch (e) {
      if ((e as { code?: string }).code === "P2002")
        throw new AppError(409, "EMAIL_TAKEN", "An account with that email already exists.");
      throw e;
    }
  }
  async login(input: { email: string; password: string }) {
    const user = await this.db.user.findUnique({ where: { email: input.email } });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      this.logger.warn({ event: "login_failed" }, "Login failed");
      throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    }
    return { user: this.public(user), token: await this.token(user.id) };
  }
  async verify(token: string) {
    try {
      const { payload } = await jwtVerify(token, this.key, { algorithms: ["HS256"] });
      if (typeof payload.sub !== "string") throw new Error();
      return payload.sub;
    } catch {
      throw new AppError(401, "UNAUTHENTICATED", "Please sign in.");
    }
  }
  async getUser(id: string) {
    const u = await this.db.user.findUnique({ where: { id } });
    if (!u) throw new AppError(401, "UNAUTHENTICATED", "Please sign in.");
    return this.public(u);
  }
  private token(id: string) {
    return new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(id)
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(this.key);
  }
  private public(u: { id: string; name: string; email: string; role: "USER" | "ADMIN" }) {
    return { id: u.id, name: u.name, email: u.email, role: u.role };
  }
}
