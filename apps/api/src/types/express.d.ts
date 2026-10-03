declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: { userId: string; role: "USER" | "ADMIN" };
      validated?: { body?: unknown; params?: unknown; query?: unknown };
    }
  }
}
export {};
