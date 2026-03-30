import { Request, Response, NextFunction } from "express";
import { db } from "../db/index";
import { sql } from "drizzle-orm";

/**
 * Get the parent PM user ID.
 * If the user IS a PM, returns their own ID.
 * If the user is a PM_TEAM_MEMBER, returns their PM's ID.
 */
export async function getPmUserId(req: Request): Promise<string> {
  const userId = req.session.userId!;
  const userRole = req.session.userRole!;

  if (userRole === "PROPERTY_MANAGER") return userId;

  if (userRole === "PM_TEAM_MEMBER") {
    const result = await db.execute(sql`
      SELECT pm_user_id FROM pm_team_members
      WHERE user_id = ${userId} AND status = 'active'
      LIMIT 1
    `);
    if (result.rows.length === 0) throw new Error("No active team membership");
    return (result.rows[0] as any).pm_user_id;
  }

  throw new Error("Not a PM or team member");
}

/**
 * Get permissions for the current user.
 * PM gets all permissions. Team member gets their role's permissions.
 */
async function getPermissions(req: Request): Promise<string[]> {
  const userRole = req.session.userRole!;

  if (userRole === "PROPERTY_MANAGER") {
    // PM has all permissions
    return ["*"];
  }

  if (userRole === "PM_TEAM_MEMBER") {
    const userId = req.session.userId!;
    const result = await db.execute(sql`
      SELECT r.permissions
      FROM pm_team_members tm
      JOIN pm_roles r ON r.id = tm.role_id
      WHERE tm.user_id = ${userId} AND tm.status = 'active'
      LIMIT 1
    `);

    if (result.rows.length === 0) return [];
    try {
      return JSON.parse((result.rows[0] as any).permissions || "[]");
    } catch {
      return [];
    }
  }

  return [];
}

/**
 * Middleware: require a specific permission.
 * PMs pass through automatically. Team members must have the permission in their role.
 * Non-PM roles (PO, Guest, Admin) pass through — they have their own access checks in routes.
 */
export function requirePmPermission(...requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userRole = req.session.userRole;

      // Block CLEANER — they should never access PM routes
      if (userRole === "CLEANER") {
        return res.status(403).json({ error: "Access denied" });
      }

      // Non-PM roles pass through (routes handle their own access checks)
      if (!userRole || !["PROPERTY_MANAGER", "PM_TEAM_MEMBER"].includes(userRole)) {
        return next();
      }

      // PM always passes
      if (userRole === "PROPERTY_MANAGER") return next();

      // Team member: check permissions
      const permissions = await getPermissions(req);

      if (permissions.includes("*")) return next();

      for (const required of requiredPermissions) {
        if (!permissions.includes(required)) {
          return res.status(403).json({ error: `Permission denied: ${required}` });
        }
      }

      return next();
    } catch (error: any) {
      return res.status(403).json({ error: error.message || "Permission check failed" });
    }
  };
}

/**
 * Check if request is from PM or PM_TEAM_MEMBER (any permission).
 */
export function requirePmOrTeam() {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.session.userRole;
    if (!userRole || !["PROPERTY_MANAGER", "PM_TEAM_MEMBER"].includes(userRole)) {
      return res.status(403).json({ error: "Access denied" });
    }
    return next();
  };
}
