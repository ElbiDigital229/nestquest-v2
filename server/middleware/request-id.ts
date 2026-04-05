/**
 * Request ID Middleware
 *
 * Attaches a unique request ID to every inbound request for end-to-end tracing.
 *
 * - Uses the incoming `x-request-id` header if provided (e.g. from a load balancer)
 * - Falls back to a randomly generated UUID
 * - Echoes the ID back in the `x-request-id` response header
 * - Attaches to `req.requestId` for use in logs and error responses
 */

import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers["x-request-id"] as string) || crypto.randomUUID();
  req.requestId = id;
  res.setHeader("x-request-id", id);
  next();
}
