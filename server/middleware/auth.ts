import { Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    userId: string;
    userRole: string;
    userEmail: string;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!roles.includes(req.session.userRole)) {
      return res.status(403).json({ error: "Access denied" });
    }
    next();
  };
}
