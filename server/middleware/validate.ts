import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { ValidationError } from "../errors/index";

/**
 * Express middleware that validates req.body against a Zod schema.
 * On failure, throws a ValidationError (400) with field-level details.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (result.success) {
      req.body = result.data; // coerce types (e.g. strip unknown fields)
      return next();
    }

    const details: Record<string, string[]> = {};
    for (const issue of (result.error as ZodError).issues) {
      const key = issue.path.join(".") || "_root";
      if (!details[key]) details[key] = [];
      details[key].push(issue.message);
    }

    return next(new ValidationError("Validation failed", details));
  };
}
