import { Router, Request, Response } from "express";
import { db } from "../db/index";
import { pmPoLinks, users, userAuditLog } from "../../shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { createNotification } from "../utils/notify";
import { checkPlanLimit } from "../middleware/plan-limits";
import crypto from "crypto";

async function auditLog(userId: string, action: string, details: string, metadata: object, ipAddress?: string) {
  await db.insert(userAuditLog).values({
    id: crypto.randomUUID(),
    userId,
    action: action as any,
    details,
    metadata: JSON.stringify(metadata),
    ipAddress: ipAddress || null,
  });
}

const router = Router();

router.use(requireAuth);

// ── POST /api/links/invite ─────────────────────────────
// PM sends invite to PO or Tenant by email
router.post("/invite", async (req: Request, res: Response) => {
  try {
    const { userId, userRole } = req.session;

    if (userRole !== "PROPERTY_MANAGER") {
      return res.status(403).json({ error: "Only Property Managers can send invites" });
    }

    const { email, targetRole } = req.body;

    if (!email?.trim()) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!["PROPERTY_OWNER", "TENANT"].includes(targetRole)) {
      return res.status(400).json({ error: "Invalid target role" });
    }

    // Find target user by email + role
    const [targetUser] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        and(
          eq(users.email, email.toLowerCase().trim()),
          eq(users.role, targetRole)
        )
      )
      .limit(1);

    if (!targetUser) {
      return res.status(404).json({ error: "Account doesn't exist" });
    }

    if (targetUser.id === userId) {
      return res.status(400).json({ error: "Cannot invite yourself" });
    }

    // Check plan limit
    const featureKey = targetRole === "PROPERTY_OWNER" ? "max_linked_owners" : "max_linked_tenants";
    const currentLinks = await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM pm_po_links
      WHERE pm_user_id = ${userId!} AND target_role = ${targetRole} AND status IN ('pending', 'accepted')
    `);
    const currentCount = (currentLinks.rows[0] as any).count;
    const planCheck = await checkPlanLimit(userId!, featureKey, currentCount);
    if (!planCheck.allowed) {
      return res.status(403).json({ error: planCheck.message, feature: featureKey, limit: true });
    }

    // Check for existing link
    const [existing] = await db
      .select()
      .from(pmPoLinks)
      .where(
        and(
          eq(pmPoLinks.pmUserId, userId!),
          eq(pmPoLinks.targetUserId, targetUser.id)
        )
      )
      .limit(1);

    if (existing) {
      if (existing.status === "accepted") {
        return res.status(409).json({ error: "Already linked with this user" });
      }
      if (existing.status === "pending") {
        return res.status(409).json({ error: "Invite already sent" });
      }
      // If rejected, delete old record so we can re-invite
      if (existing.status === "rejected") {
        await db.delete(pmPoLinks).where(eq(pmPoLinks.id, existing.id));
      }
    }

    // Get PM's name for notification
    const [pmUser] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, userId!))
      .limit(1);

    const pmName = pmUser?.fullName || "A Property Manager";

    // Create the link
    const [link] = await db
      .insert(pmPoLinks)
      .values({
        pmUserId: userId!,
        targetUserId: targetUser.id,
        targetRole,
        status: "pending",
      })
      .returning();

    // Get target name for audit
    const [targetUserProfile] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, targetUser.id))
      .limit(1);
    const targetName = targetUserProfile?.fullName || targetUser.email;

    // Notify target user
    await createNotification({
      userId: targetUser.id,
      type: "LINK_INVITE",
      title: `New invite from ${pmName}`,
      body: `${pmName} wants to link with you as a Property Manager`,
      linkUrl: "/portal/property-managers",
      relatedId: link.id,
    });

    // Audit log for both parties
    const meta = { linkId: link.id, otherUserId: targetUser.id, otherRole: targetRole };
    await auditLog(userId!, "LINK_INVITE_SENT", `Sent invite to ${targetName} (${targetUser.email})`, meta, req.ip);
    await auditLog(targetUser.id, "LINK_INVITE_RECEIVED", `Received invite from ${pmName}`, { linkId: link.id, otherUserId: userId, otherRole: "PROPERTY_MANAGER" }, req.ip);

    return res.status(201).json(link);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── GET /api/links ─────────────────────────────────────
// List links for current user
router.get("/", async (req: Request, res: Response) => {
  try {
    const { userId, userRole } = req.session;
    const statusFilter = req.query.status as string;
    const targetRoleFilter = req.query.targetRole as string;

    if (userRole === "PROPERTY_MANAGER") {
      // PM sees their linked POs/Tenants
      const conditions: any[] = [eq(pmPoLinks.pmUserId, userId!)];
      if (statusFilter) conditions.push(eq(pmPoLinks.status, statusFilter as any));
      if (targetRoleFilter) conditions.push(eq(pmPoLinks.targetRole, targetRoleFilter));

      const rows = await db.execute(sql`
        SELECT
          l.id,
          l.pm_user_id AS "pmUserId",
          l.target_user_id AS "targetUserId",
          l.target_role AS "targetRole",
          l.status,
          l.created_at AS "createdAt",
          l.updated_at AS "updatedAt",
          u.full_name AS "targetName",
          u.email AS "targetEmail",
          u.phone AS "targetPhone"
        FROM pm_po_links l
        JOIN users u ON u.id = l.target_user_id
        WHERE l.pm_user_id = ${userId!}
        ${statusFilter ? sql`AND l.status = ${statusFilter}` : sql``}
        ${targetRoleFilter ? sql`AND l.target_role = ${targetRoleFilter}` : sql``}
        ORDER BY l.created_at DESC
      `);

      return res.json(rows.rows);
    } else if (userRole === "PROPERTY_OWNER" || userRole === "TENANT") {
      // PO/Tenant sees their linked PMs
      const rows = await db.execute(sql`
        SELECT
          l.id,
          l.pm_user_id AS "pmUserId",
          l.target_user_id AS "targetUserId",
          l.target_role AS "targetRole",
          l.status,
          l.created_at AS "createdAt",
          l.updated_at AS "updatedAt",
          u.full_name AS "pmName",
          u.email AS "pmEmail",
          u.phone AS "pmPhone"
        FROM pm_po_links l
        JOIN users u ON u.id = l.pm_user_id
        WHERE l.target_user_id = ${userId!}
        ${statusFilter ? sql`AND l.status = ${statusFilter}` : sql``}
        ORDER BY l.created_at DESC
      `);

      return res.json(rows.rows);
    }

    return res.status(403).json({ error: "Access denied" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── GET /api/links/:linkId/details ─────────────────────
// PO/Tenant views PM details before accepting
router.get("/:linkId/details", async (req: Request, res: Response) => {
  try {
    const { userId, userRole } = req.session;

    if (userRole !== "PROPERTY_OWNER" && userRole !== "TENANT") {
      return res.status(403).json({ error: "Access denied" });
    }

    const [link] = await db
      .select()
      .from(pmPoLinks)
      .where(
        and(
          eq(pmPoLinks.id, req.params.linkId),
          eq(pmPoLinks.targetUserId, userId!)
        )
      )
      .limit(1);

    if (!link) {
      return res.status(404).json({ error: "Link not found" });
    }

    // Get PM details
    const rows = await db.execute(sql`
      SELECT
        u.id,
        u.full_name AS "fullName",
        u.email,
        u.phone,
        u.created_at AS "createdAt",
        0 AS "propertiesManaged"
      FROM users u
      WHERE u.id = ${link.pmUserId}
    `);

    if (rows.rows.length === 0) {
      return res.status(404).json({ error: "PM not found" });
    }

    return res.json(rows.rows[0]);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── PATCH /api/links/:linkId/respond ───────────────────
// PO/Tenant accepts or rejects
router.patch("/:linkId/respond", async (req: Request, res: Response) => {
  try {
    const { userId, userRole } = req.session;

    if (userRole !== "PROPERTY_OWNER" && userRole !== "TENANT") {
      return res.status(403).json({ error: "Access denied" });
    }

    const { action } = req.body;
    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({ error: "Action must be 'accept' or 'reject'" });
    }

    const [link] = await db
      .select()
      .from(pmPoLinks)
      .where(
        and(
          eq(pmPoLinks.id, req.params.linkId),
          eq(pmPoLinks.targetUserId, userId!),
          eq(pmPoLinks.status, "pending")
        )
      )
      .limit(1);

    if (!link) {
      return res.status(404).json({ error: "Pending invite not found" });
    }

    // Get responder's name
    const [responderUser] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, userId!))
      .limit(1);
    const responderName = responderUser?.fullName || "User";

    // Get PM's name for audit
    const [pmUser2] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, link.pmUserId))
      .limit(1);
    const pmName = pmUser2?.fullName || "Property Manager";

    if (action === "accept") {
      await db
        .update(pmPoLinks)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(eq(pmPoLinks.id, link.id));

      const linkUrl = link.targetRole === "TENANT" ? "/portal/tenants" : "/portal/property-owners";

      await createNotification({
        userId: link.pmUserId,
        type: "LINK_ACCEPTED",
        title: `${responderName} accepted your invite`,
        body: `You are now linked with ${responderName}`,
        linkUrl,
        relatedId: link.id,
      });

      // Audit log for both
      await auditLog(userId!, "LINK_ACCEPTED", `Accepted link with ${pmName}`, { linkId: link.id, otherUserId: link.pmUserId }, req.ip);
      await auditLog(link.pmUserId, "LINK_ACCEPTED", `${responderName} accepted link`, { linkId: link.id, otherUserId: userId }, req.ip);

      return res.json({ ok: true, status: "accepted" });
    } else {
      // Reject → delete record so PM can re-invite
      await db.delete(pmPoLinks).where(eq(pmPoLinks.id, link.id));

      const linkUrl = link.targetRole === "TENANT" ? "/portal/tenants" : "/portal/property-owners";

      await createNotification({
        userId: link.pmUserId,
        type: "LINK_REJECTED",
        title: `${responderName} declined your invite`,
        linkUrl,
        relatedId: link.id,
      });

      // Audit log for both
      await auditLog(userId!, "LINK_REJECTED", `Rejected invite from ${pmName}`, { linkId: link.id, otherUserId: link.pmUserId }, req.ip);
      await auditLog(link.pmUserId, "LINK_REJECTED", `${responderName} rejected your invite`, { linkId: link.id, otherUserId: userId }, req.ip);

      return res.json({ ok: true, status: "rejected" });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── DELETE /api/links/:linkId ──────────────────────────
// PM or PO/Tenant unlinks
router.delete("/:linkId", async (req: Request, res: Response) => {
  try {
    const { userId, userRole } = req.session;

    if (!["PROPERTY_MANAGER", "PROPERTY_OWNER", "TENANT"].includes(userRole!)) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Find link where user is either the PM or the target
    const [link] = await db
      .select()
      .from(pmPoLinks)
      .where(eq(pmPoLinks.id, req.params.linkId))
      .limit(1);

    if (!link) {
      return res.status(404).json({ error: "Link not found" });
    }

    // Verify user is part of this link
    const isPm = link.pmUserId === userId;
    const isTarget = link.targetUserId === userId;
    if (!isPm && !isTarget) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get both parties' names
    const [unlinkerUser] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, userId!))
      .limit(1);
    const unlinkerName = unlinkerUser?.fullName || "A user";

    const otherUserId = isPm ? link.targetUserId : link.pmUserId;

    const [otherUser] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, otherUserId))
      .limit(1);
    const otherName = otherUser?.fullName || "User";

    await db.delete(pmPoLinks).where(eq(pmPoLinks.id, link.id));

    // Notify the other party
    const linkUrl = isPm
      ? "/portal/property-managers"
      : link.targetRole === "TENANT" ? "/portal/tenants" : "/portal/property-owners";

    await createNotification({
      userId: otherUserId,
      type: "LINK_REMOVED",
      title: `${unlinkerName} has unlinked from you`,
      linkUrl,
      relatedId: link.id,
    });

    // Audit log for both
    await auditLog(userId!, "LINK_REMOVED", `Unlinked from ${otherName}`, { linkId: link.id, otherUserId }, req.ip);
    await auditLog(otherUserId, "LINK_REMOVED", `${unlinkerName} unlinked from you`, { linkId: link.id, otherUserId: userId }, req.ip);

    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── GET /api/links/:linkId/full-profile ───────────────
// PM views full profile of linked PO/Tenant
router.get("/:linkId/full-profile", async (req: Request, res: Response) => {
  try {
    const { userId, userRole } = req.session;

    if (userRole !== "PROPERTY_MANAGER") {
      return res.status(403).json({ error: "Only Property Managers can view full profiles" });
    }

    const [link] = await db
      .select()
      .from(pmPoLinks)
      .where(
        and(
          eq(pmPoLinks.id, req.params.linkId),
          eq(pmPoLinks.pmUserId, userId!),
          eq(pmPoLinks.status, "accepted")
        )
      )
      .limit(1);

    if (!link) {
      return res.status(404).json({ error: "Accepted link not found" });
    }

    const rows = await db.execute(sql`
      SELECT
        u.id,
        u.email,
        u.phone,
        u.role,
        u.status AS "accountStatus",
        u.created_at AS "createdAt",
        u.full_name AS "fullName",
        u.dob,
        u.nationality,
        u.country_of_residence AS "countryOfResidence",
        u.resident_address AS "residentAddress",
        u.emirates_id_number AS "emiratesIdNumber",
        u.emirates_id_expiry AS "emiratesIdExpiry",
        u.emirates_id_front_url AS "emiratesIdFrontUrl",
        u.emirates_id_back_url AS "emiratesIdBackUrl",
        u.passport_number AS "passportNumber",
        u.passport_expiry AS "passportExpiry",
        u.passport_front_url AS "passportFrontUrl",
        u.trade_license_expiry AS "tradeLicenseExpiry",
        u.trade_license_url AS "tradeLicenseUrl",
        u.company_name AS "companyName",
        u.company_website AS "companyWebsite",
        u.company_description AS "companyDescription",
        u.company_address AS "companyAddress",
        u.kyc_status AS "kycStatus"
      FROM users u
      WHERE u.id = ${link.targetUserId}
    `);

    if (rows.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(rows.rows[0]);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── GET /api/links/user/:userId ──────────────────────
// SA views linked users for any user
router.get("/user/:userId", async (req: Request, res: Response) => {
  try {
    const { userRole } = req.session;

    if (userRole !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Admin only" });
    }

    const targetUserId = req.params.userId;

    // Get the user's role
    const [targetUser] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (targetUser.role === "PROPERTY_MANAGER") {
      // PM: show linked POs and Tenants
      const rows = await db.execute(sql`
        SELECT
          l.id AS "linkId",
          l.target_user_id AS "userId",
          l.target_role AS "role",
          l.status,
          l.created_at AS "linkedAt",
          l.updated_at AS "updatedAt",
          u.full_name AS "fullName",
          u.email,
          u.phone,
          u.id AS "guestId"
        FROM pm_po_links l
        JOIN users u ON u.id = l.target_user_id
        WHERE l.pm_user_id = ${targetUserId}
        ORDER BY l.created_at DESC
      `);
      return res.json(rows.rows);
    } else if (targetUser.role === "PROPERTY_OWNER" || targetUser.role === "TENANT") {
      // PO/Tenant: show linked PMs
      const rows = await db.execute(sql`
        SELECT
          l.id AS "linkId",
          l.pm_user_id AS "userId",
          'PROPERTY_MANAGER' AS "role",
          l.status,
          l.created_at AS "linkedAt",
          l.updated_at AS "updatedAt",
          u.full_name AS "fullName",
          u.email,
          u.phone,
          u.id AS "guestId"
        FROM pm_po_links l
        JOIN users u ON u.id = l.pm_user_id
        WHERE l.target_user_id = ${targetUserId}
        ORDER BY l.created_at DESC
      `);
      return res.json(rows.rows);
    }

    return res.json([]);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
