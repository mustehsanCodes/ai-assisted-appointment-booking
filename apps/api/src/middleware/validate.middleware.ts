import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError } from "../errors/app-error.js";
export const validate =
  (part: "body" | "params" | "query", schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      next(
        new AppError(
          400,
          "VALIDATION_ERROR",
          "Check the submitted fields.",
          result.error.flatten().fieldErrors as Record<string, string[]>,
        ),
      );
      return;
    }
    req.validated ??= {};
    req.validated[part] = result.data;
    next();
  };
