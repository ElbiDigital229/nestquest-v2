import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { db } from "../db/index";
import { users, guests, pmRoles, pmTeamMembers, userAuditLog } from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requirePmPermission, getPmUserId } from "../middleware/pm-permissions";
import { createNotification } from "../utils/notify";

const router = Router();
router.use(requireAuth);

// Block non-PM/non-team roles from all team routes
router.use((req, res, next) => {
  const role = req.session.userRole;
  if (!role || !["PROPERTY_MANAGER", "PM_TEAM_MEMBER"].includes(role)) {
    return res.status(403).json({ error: "Access denied" });
  }
  next();
});

// ── ROLES CRUD ──────────────────────────────────────────

// List PM's roles
router.get("/roles", requirePmPermission("team.manage"), async (req: Request, res: Response) => {
  try {
    const pmId = await getPmUserId(req);
    const roles = await db.select().from(pmRoles).where(eq(pmRoles.pmUserId, pmId));

    // Count members per role
    const result = [];
    for (const role of roles) {
      const countResult = await db.execute(sql`
        SELECT COUNT(*)::int AS count FROM pm_team_members WHERE role_id = ${role.id} AND status = 'active'
      `);
      result.push({ ...role, permissions: JSON.parse(role.permissions || "[]"), memberCount: (countResult.rows[0] as any)?.count || 0 });
    }

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Create role
router.post("/roles", requirePmPermission("team.manage"), async (req: Request, res: Response) => {
  try {
    const pmId = await getPmUserId(req);
    const { name, description, permissions } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: "Role name is required" });

    const [role] = await db.insert(pmRoles).values({
      pmUserId: pmId,
      name: name.trim(),
      description: description || null,
      permissions: JSON.stringify(permissions || []),
    }).returning();

    return res.status(201).json({ ...role, permissions: JSON.parse(role.permissions || "[]") });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Update role
router.patch("/roles/:id", requirePmPermission("team.manage"), async (req: Request, res: Response) => {
  try {
    const pmId = await getPmUserId(req);
    const { id } = req.params;
    const { name, description, permissions } = req.body;

    const updates: any = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (permissions !== undefined) updates.permissions = JSON.stringify(permissions);

    const [updated] = await db.update(pmRoles)
      .set(updates)
      .where(and(eq(pmRoles.id, id), eq(pmRoles.pmUserId, pmId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Role not found" });
    return res.json({ ...updated, permissions: JSON.parse(updated.permissions || "[]") });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Delete role
router.delete("/roles/:id", requirePmPermission("team.manage"), async (req: Request, res: Response) => {
  try {
    const pmId = await getPmUserId(req);
    const { id } = req.params;

    await db.delete(pmRoles).where(and(eq(pmRoles.id, id), eq(pmRoles.pmUserId, pmId)));
    return res.json({ message: "Role deleted" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── TEAM MEMBERS ────────────────────────────────────────

// List team members
router.get("/members", requirePmPermission("team.manage"), async (req: Request, res: Response) => {
  try {
    const pmId = await getPmUserId(req);

    const result = await db.execute(sql`
      SELECT tm.id, tm.user_id AS "userId", tm.role_id AS "roleId", tm.status,
        tm.invited_at AS "invitedAt", tm.accepted_at AS "acceptedAt",
        u.email, u.phone, u.status AS "userStatus",
        g.full_name AS "fullName",
        r.name AS "roleName", r.permissions AS "rolePermissions"
      FROM pm_team_members tm
      JOIN users u ON u.id = tm.user_id
      LEFT JOIN guests g ON g.user_id = tm.user_id
      LEFT JOIN pm_roles r ON r.id = tm.role_id
      WHERE tm.pm_user_id = ${pmId}
      ORDER BY tm.created_at DESC
    `);

    return res.json(result.rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Invite team member
router.post("/members/invite", requirePmPermission("team.manage"), async (req: Request, res: Response) => {
  try {
    const pmId = await getPmUserId(req);
    const { email, fullName, roleId, phone } = req.body;

    if (!email?.trim()) return res.status(400).json({ error: "Email is required" });
    if (!fullName?.trim()) return res.status(400).json({ error: "Full name is required" });
    if (!roleId?.trim()) return res.status(400).json({ error: "Role is required" });

    const emailLower = email.toLowerCase().trim();

    // Check if already an active team member for this PM
    const existing = await db.execute(sql`
      SELECT tm.id, tm.status FROM pm_team_members tm
      JOIN users u ON u.id = tm.user_id
      WHERE tm.pm_user_id = ${pmId} AND u.email = ${emailLower} AND u.role = 'PM_TEAM_MEMBER'
    `);
    if (existing.rows.length > 0) {
      const member = existing.rows[0] as any;
      if (member.status === "active") {
        return res.status(400).json({ error: "This person is already on your team" });
      }
      // Re-activate removed member
      await db.execute(sql`
        UPDATE pm_team_members SET status = 'active', role_id = ${roleId || null}, accepted_at = NOW(), updated_at = NOW()
        WHERE id = ${member.id}
      `);
      return res.status(200).json({ id: member.id, reactivated: true });
    }

    // Check if email is already a PM_TEAM_MEMBER for another PM
    const otherTeam = await db.execute(sql`
      SELECT tm.id FROM pm_team_members tm
      JOIN users u ON u.id = tm.user_id
      WHERE u.email = ${emailLower} AND u.role = 'PM_TEAM_MEMBER' AND tm.pm_user_id != ${pmId} AND tm.status = 'active'
    `);
    if (otherTeam.rows.length > 0) {
      return res.status(400).json({ error: "This person is already on another PM's team" });
    }

    // Find or create PM_TEAM_MEMBER user
    let [teamUser] = await db.select().from(users)
      .where(and(eq(users.email, emailLower), eq(users.role, "PM_TEAM_MEMBER")))
      .limit(1);

    if (!teamUser) {
      // Create the user with a temporary password (no guests record needed for team members)
      const passwordHash = await bcrypt.hash("Welcome1!", 10);
      [teamUser] = await db.insert(users).values({
        email: emailLower,
        passwordHash,
        role: "PM_TEAM_MEMBER",
        phone: phone || null,
        status: "active",
      }).returning();
    }

    // Create team membership (name stored here, not in guests table)
    const [membership] = await db.insert(pmTeamMembers).values({
      pmUserId: pmId,
      userId: teamUser.id,
      fullName: fullName.trim(),
      roleId: roleId || null,
      status: "active",
      acceptedAt: new Date(),
    }).returning();

    // Audit log
    await db.insert(userAuditLog).values({
      userId: pmId,
      action: "SETTINGS_UPDATED",
      details: `Invited team member: ${fullName} (${emailLower})`,
      metadata: JSON.stringify({ teamMemberId: membership.id, roleId }),
    });

    return res.status(201).json({ id: membership.id, userId: teamUser.id });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Get team member detail
router.get("/members/:id", requirePmPermission("team.manage"), async (req: Request, res: Response) => {
  try {
    const pmId = await getPmUserId(req);
    const { id } = req.params;

    const result = await db.execute(sql`
      SELECT tm.id, tm.user_id AS "userId", tm.role_id AS "roleId", tm.status,
        tm.invited_at AS "invitedAt", tm.accepted_at AS "acceptedAt",
        u.email, u.phone, u.status AS "userStatus", u.created_at AS "userCreatedAt",
        g.full_name AS "fullName", g.dob, g.nationality, g.country_of_residence AS "countryOfResidence",
        g.resident_address AS "residentAddress", g.emirates_id_number AS "emiratesIdNumber",
        r.name AS "roleName", r.permissions AS "rolePermissions"
      FROM pm_team_members tm
      JOIN users u ON u.id = tm.user_id
      LEFT JOIN guests g ON g.user_id = tm.user_id
      LEFT JOIN pm_roles r ON r.id = tm.role_id
      WHERE tm.id = ${id} AND tm.pm_user_id = ${pmId}
    `);

    if (result.rows.length === 0) return res.status(404).json({ error: "Member not found" });
    return res.json(result.rows[0]);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Update team member details (profile, role, phone, password)
router.patch("/members/:id", requirePmPermission("team.manage"), async (req: Request, res: Response) => {
  try {
    const pmId = await getPmUserId(req);
    const { id } = req.params;
    const { roleId, status, fullName, phone, email, newPassword } = req.body;

    // Get the membership to find user_id
    const [membership] = await db.select().from(pmTeamMembers)
      .where(and(eq(pmTeamMembers.id, id), eq(pmTeamMembers.pmUserId, pmId)))
      .limit(1);
    if (!membership) return res.status(404).json({ error: "Team member not found" });

    // Update team membership fields
    const tmUpdates: any = { updatedAt: new Date() };
    if (roleId !== undefined) tmUpdates.roleId = roleId || null;
    if (status !== undefined) tmUpdates.status = status;
    await db.update(pmTeamMembers).set(tmUpdates).where(eq(pmTeamMembers.id, id));

    // Update user fields
    const userUpdates: any = { updatedAt: new Date() };
    if (phone !== undefined) userUpdates.phone = phone || null;
    if (email !== undefined) userUpdates.email = email.toLowerCase().trim();
    if (newPassword) userUpdates.passwordHash = await bcrypt.hash(newPassword, 10);
    if (Object.keys(userUpdates).length > 1) {
      await db.update(users).set(userUpdates).where(eq(users.id, membership.userId));
    }

    // Update team member name
    if (fullName !== undefined) {
      await db.execute(sql`
        UPDATE pm_team_members SET full_name = ${fullName}, updated_at = NOW()
        WHERE id = ${id}
      `);
    }

    return res.json({ message: "Member updated" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Remove team member
router.delete("/members/:id", requirePmPermission("team.manage"), async (req: Request, res: Response) => {
  try {
    const pmId = await getPmUserId(req);
    const { id } = req.params;

    await db.update(pmTeamMembers)
      .set({ status: "removed", updatedAt: new Date() })
      .where(and(eq(pmTeamMembers.id, id), eq(pmTeamMembers.pmUserId, pmId)));

    return res.json({ message: "Team member removed" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── ACTIVITY LOG per team member ────────────────────────

router.get("/activity/:userId", requirePmPermission("team.manage"), async (req: Request, res: Response) => {
  try {
    const pmId = await getPmUserId(req);
    const { userId } = req.params;

    // Verify this user is on the PM's team
    const membership = await db.execute(sql`
      SELECT id FROM pm_team_members WHERE pm_user_id = ${pmId} AND user_id = ${userId}
    `);
    if (membership.rows.length === 0) return res.status(403).json({ error: "Not on your team" });

    // Property activity
    const activity = await db.execute(sql`
      SELECT al.id, al.action, al.description, al.metadata, al.created_at AS "createdAt",
        p.public_name AS "propertyName"
      FROM st_property_activity_log al
      JOIN st_properties p ON p.id = al.property_id
      WHERE al.user_id = ${userId} AND p.pm_user_id = ${pmId}
      ORDER BY al.created_at DESC
      LIMIT 50
    `);

    // User audit log
    const audit = await db.execute(sql`
      SELECT id, action, details, created_at AS "createdAt"
      FROM user_audit_log WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 50
    `);

    return res.json({ propertyActivity: activity.rows, auditLog: audit.rows });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── GET /my-profile — Team member's own profile ────────

router.get("/my-profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    if (req.session.userRole !== "PM_TEAM_MEMBER") {
      return res.status(403).json({ error: "Not a team member" });
    }

    const result = await db.execute(sql`
      SELECT tm.id, tm.full_name AS "fullName", tm.status,
        tm.invited_at AS "invitedAt", tm.accepted_at AS "acceptedAt",
        u.email, u.phone,
        r.name AS "roleName", r.permissions,
        pm_g.full_name AS "pmName", pm_u.email AS "pmEmail"
      FROM pm_team_members tm
      JOIN users u ON u.id = tm.user_id
      LEFT JOIN pm_roles r ON r.id = tm.role_id
      JOIN users pm_u ON pm_u.id = tm.pm_user_id
      LEFT JOIN guests pm_g ON pm_g.user_id = tm.pm_user_id
      WHERE tm.user_id = ${userId} AND tm.status = 'active'
      LIMIT 1
    `);

    if (result.rows.length === 0) return res.status(404).json({ error: "Profile not found" });
    const profile = result.rows[0] as any;
    return res.json({
      ...profile,
      permissions: profile.permissions ? JSON.parse(profile.permissions) : [],
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── PATCH /my-profile — Team member updates own profile ──

router.patch("/my-profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    if (req.session.userRole !== "PM_TEAM_MEMBER") {
      return res.status(403).json({ error: "Not a team member" });
    }

    const { fullName, phone, currentPassword, newPassword } = req.body;

    // Update name in pm_team_members
    if (fullName !== undefined) {
      await db.execute(sql`
        UPDATE pm_team_members SET full_name = ${fullName}, updated_at = NOW()
        WHERE user_id = ${userId} AND status = 'active'
      `);
    }

    // Update phone in users
    if (phone !== undefined) {
      await db.execute(sql`UPDATE users SET phone = ${phone || null}, updated_at = NOW() WHERE id = ${userId}`);
    }

    // Change password
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: "Current password is required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return res.status(404).json({ error: "User not found" });

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return res.status(400).json({ error: "Current password is incorrect" });

      const hash = await bcrypt.hash(newPassword, 10);
      await db.execute(sql`UPDATE users SET password_hash = ${hash}, updated_at = NOW() WHERE id = ${userId}`);
    }

    return res.json({ message: "Profile updated" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
