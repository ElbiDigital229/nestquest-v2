import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { db } from "../db/index";
import { messages, users, pmPoLinks, pmTeamMembers, userAuditLog, PORTAL_ROLES } from "../../shared/schema";
import { eq, and, isNull, ne, sql, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { createNotification } from "../utils/notify";
import { checkPlanLimit } from "../middleware/plan-limits";
import { sanitize } from "../utils/sanitize";

const router = Router();

router.use(requireAuth);

const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { error: "Too many messages. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Helper: conversation ID for a user (now = users.id) ─

async function getGuestIdForUser(userId: string): Promise<string | null> {
  return userId;
}

// ── Helper: check if PM has a booking with this guest ──

async function pmHasGuestAccess(pmId: string, guestId: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM st_bookings
    WHERE pm_user_id = ${pmId} AND guest_user_id = ${guestId}
    LIMIT 1
  `);
  return result.rows.length > 0;
}

// ── Helper: check if PO owns a property with a booking for this guest ──

async function poHasGuestAccess(poId: string, guestId: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM st_bookings b
    JOIN st_properties p ON p.id = b.property_id
    WHERE p.po_user_id = ${poId} AND b.guest_user_id = ${guestId}
    LIMIT 1
  `);
  return result.rows.length > 0;
}

// ── Helper: resolve actual PM user ID (handles team members) ──

async function resolvePmId(userId: string, userRole: string): Promise<string> {
  if (userRole === "PM_TEAM_MEMBER") {
    const [tm] = await db.execute(sql`
      SELECT pm_user_id FROM pm_team_members WHERE user_id = ${userId} AND status = 'active' LIMIT 1
    `);
    return (tm as any)?.pm_user_id || userId;
  }
  return userId;
}

// ══════════════════════════════════════════════════════
// PM → Guest conversation list (registered before /:guestId)
// ══════════════════════════════════════════════════════

router.get("/guest-conversations", async (req: Request, res: Response) => {
  try {
    const { userId, userRole } = req.session;
    if (!["PROPERTY_MANAGER", "PM_TEAM_MEMBER"].includes(userRole!)) {
      return res.status(403).json({ error: "PM only" });
    }
    const pmId = await resolvePmId(userId!, userRole!);

    const rows = await db.execute(sql`
      SELECT DISTINCT ON (b.guest_user_id)
        b.guest_user_id AS "guestId",
        COALESCE(u.full_name, b.guest_name, 'Guest') AS "guestName",
        u.email AS "guestEmail",
        (SELECT content FROM messages WHERE conversation_id = b.guest_user_id ORDER BY created_at DESC LIMIT 1) AS "lastMessage",
        (SELECT created_at FROM messages WHERE conversation_id = b.guest_user_id ORDER BY created_at DESC LIMIT 1) AS "lastMessageAt",
        (SELECT COUNT(*)::int FROM messages WHERE conversation_id = b.guest_user_id AND sender_id != ${pmId} AND read_at IS NULL) AS "unreadCount"
      FROM st_bookings b
      LEFT JOIN users u ON u.id = b.guest_user_id
      WHERE b.pm_user_id = ${pmId} AND b.guest_user_id IS NOT NULL
      ORDER BY b.guest_user_id, "lastMessageAt" DESC NULLS LAST
    `);
    return res.json(rows.rows);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /chat/po-guest-conversations — PO sees guests on their properties ──

router.get("/po-guest-conversations", async (req: Request, res: Response) => {
  try {
    const { userId, userRole } = req.session;
    if (userRole !== "PROPERTY_OWNER") {
      return res.status(403).json({ error: "Property owners only" });
    }

    const rows = await db.execute(sql`
      SELECT DISTINCT ON (b.guest_user_id)
        b.guest_user_id AS "guestId",
        COALESCE(u.full_name, b.guest_name, 'Guest') AS "guestName",
        u.email AS "guestEmail",
        p.public_name AS "propertyName",
        (SELECT content FROM messages WHERE conversation_id = b.guest_user_id ORDER BY created_at DESC LIMIT 1) AS "lastMessage",
        (SELECT created_at FROM messages WHERE conversation_id = b.guest_user_id ORDER BY created_at DESC LIMIT 1) AS "lastMessageAt",
        (SELECT COUNT(*)::int FROM messages WHERE conversation_id = b.guest_user_id AND sender_id != ${userId!} AND read_at IS NULL) AS "unreadCount"
      FROM st_bookings b
      JOIN st_properties p ON p.id = b.property_id
      LEFT JOIN users u ON u.id = b.guest_user_id
      WHERE p.po_user_id = ${userId!} AND b.guest_user_id IS NOT NULL
      ORDER BY b.guest_user_id, "lastMessageAt" DESC NULLS LAST
    `);
    return res.json(rows.rows);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════
// DM routes — must be registered BEFORE /:guestId routes
// ══════════════════════════════════════════════════════

async function validateDmAccess(linkId: string, userId: string) {
  // Check pm_po_links first
  const [link] = await db
    .select()
    .from(pmPoLinks)
    .where(and(eq(pmPoLinks.id, linkId), eq(pmPoLinks.status, "accepted")))
    .limit(1);
  if (link && (link.pmUserId === userId || link.targetUserId === userId)) return link;

  // Check team member links (using team member ID as linkId)
  const [teamLink] = await db
    .select()
    .from(pmTeamMembers)
    .where(and(eq(pmTeamMembers.id, linkId), eq(pmTeamMembers.status, "active")))
    .limit(1);
  if (teamLink && (teamLink.pmUserId === userId || teamLink.userId === userId)) {
    return { id: teamLink.id, pmUserId: teamLink.pmUserId, targetUserId: teamLink.userId, targetRole: "PM_TEAM_MEMBER", status: "accepted" };
  }

  return null;
}

router.get("/dm/conversations", async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;
    // PM-PO/Tenant links + PM-Team member links in one query
    const rows = await db.execute(sql`
      SELECT
        l.id AS "linkId",
        CASE WHEN l.pm_user_id = ${userId!} THEN l.target_user_id ELSE l.pm_user_id END AS "otherUserId",
        CASE WHEN l.pm_user_id = ${userId!} THEN l.target_role ELSE 'PROPERTY_MANAGER' END AS "otherRole",
        u.full_name AS "otherName",
        u.email AS "otherEmail",
        (SELECT content FROM messages WHERE conversation_id = l.id ORDER BY created_at DESC LIMIT 1) AS "lastMessage",
        (SELECT created_at FROM messages WHERE conversation_id = l.id ORDER BY created_at DESC LIMIT 1) AS "lastMessageAt",
        (SELECT COUNT(*)::int FROM messages WHERE conversation_id = l.id AND sender_id != ${userId!} AND read_at IS NULL) AS "unreadCount"
      FROM pm_po_links l
      JOIN users u ON u.id = CASE WHEN l.pm_user_id = ${userId!} THEN l.target_user_id ELSE l.pm_user_id END
      WHERE (l.pm_user_id = ${userId!} OR l.target_user_id = ${userId!})
      AND l.status = 'accepted'

      UNION ALL

      SELECT
        tm.id AS "linkId",
        CASE WHEN tm.pm_user_id = ${userId!} THEN tm.user_id ELSE tm.pm_user_id END AS "otherUserId",
        CASE WHEN tm.pm_user_id = ${userId!} THEN 'PM_TEAM_MEMBER' ELSE 'PROPERTY_MANAGER' END AS "otherRole",
        u2.full_name AS "otherName",
        u2.email AS "otherEmail",
        (SELECT content FROM messages WHERE conversation_id = tm.id ORDER BY created_at DESC LIMIT 1) AS "lastMessage",
        (SELECT created_at FROM messages WHERE conversation_id = tm.id ORDER BY created_at DESC LIMIT 1) AS "lastMessageAt",
        (SELECT COUNT(*)::int FROM messages WHERE conversation_id = tm.id AND sender_id != ${userId!} AND read_at IS NULL) AS "unreadCount"
      FROM pm_team_members tm
      JOIN users u2 ON u2.id = CASE WHEN tm.pm_user_id = ${userId!} THEN tm.user_id ELSE tm.pm_user_id END
      WHERE (tm.pm_user_id = ${userId!} OR tm.user_id = ${userId!})
      AND tm.status = 'active'

      ORDER BY "lastMessageAt" DESC NULLS LAST
    `);
    return res.json(rows.rows);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dm/:linkId/messages", async (req: Request, res: Response) => {
  try {
    const { userId, userRole } = req.session;
    const linkId = req.params.linkId;

    if (userRole === "SUPER_ADMIN") {
      // SA can read any DM conversation (read-only)
      const [link] = await db.select().from(pmPoLinks).where(eq(pmPoLinks.id, linkId)).limit(1);
      if (!link) return res.status(404).json({ error: "Link not found" });
      const rows = await db.select().from(messages).where(eq(messages.conversationId, link.id)).orderBy(messages.createdAt).limit(200);
      return res.json(rows);
    }

    const link = await validateDmAccess(linkId, userId!);
    if (!link) return res.status(403).json({ error: "Access denied" });
    const rows = await db.select().from(messages).where(eq(messages.conversationId, link.id)).orderBy(messages.createdAt).limit(200);
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/dm/:linkId/messages", messageLimiter, async (req: Request, res: Response) => {
  try {
    const { userId, userRole } = req.session;
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Message content is required" });
    const link = await validateDmAccess(req.params.linkId, userId!);
    if (!link) return res.status(403).json({ error: "Access denied" });

    // Check plan limit for DM messaging (only for PM)
    if (userRole === "PROPERTY_MANAGER") {
      const planCheck = await checkPlanLimit(userId!, "dm_messaging");
      if (!planCheck.allowed) {
        return res.status(403).json({ error: planCheck.message, feature: "dm_messaging", limit: true });
      }
    }

    const [msg] = await db.insert(messages).values({
      conversationId: link.id,
      senderId: userId!,
      senderRole: userRole!,
      content: sanitize(content),
    }).returning();

    try {
      const otherUserId = link.pmUserId === userId ? link.targetUserId : link.pmUserId;
      const [senderUser] = await db.select({ fullName: users.fullName }).from(users).where(eq(users.id, userId!)).limit(1);
      const senderName = senderUser?.fullName || "A user";
      await createNotification({
        userId: otherUserId,
        type: "NEW_MESSAGE",
        title: `New message from ${senderName}`,
        body: content.trim().slice(0, 100),
        linkUrl: `/portal/messages?dm=${link.id}`,
        relatedId: msg.id,
      });
    } catch {}

    // Audit log
    try {
      await db.insert(userAuditLog).values({
        userId: userId!,
        action: "MESSAGE_SENT",
        details: `DM sent in link ${link.id}`,
        metadata: JSON.stringify({ messageId: msg.id, linkId: link.id, type: "dm" }),
        ipAddress: req.ip,
      });
    } catch {}

    return res.status(201).json(msg);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/dm/:linkId/read", async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;
    const link = await validateDmAccess(req.params.linkId, userId!);
    if (!link) return res.status(403).json({ error: "Access denied" });
    await db.update(messages).set({ readAt: new Date() }).where(
      and(eq(messages.conversationId, link.id), ne(messages.senderId, userId!), isNull(messages.readAt))
    );
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════
// Admin support chat routes
// ══════════════════════════════════════════════════════

// ── GET /api/chat/:guestId/messages ────────────────────

router.get("/:guestId/messages", async (req: Request, res: Response) => {
  try {
    const { guestId } = req.params;
    const { userId, userRole } = req.session;

    // Non-admin users can only access their own conversation, or PM/PO with booking access
    if ((PORTAL_ROLES as readonly string[]).includes(userRole!)) {
      const myGuestId = await getGuestIdForUser(userId!);
      if (myGuestId !== guestId) {
        if (userRole === "PROPERTY_MANAGER" || userRole === "PM_TEAM_MEMBER") {
          const pmId = await resolvePmId(userId!, userRole!);
          const hasAccess = await pmHasGuestAccess(pmId, guestId);
          if (!hasAccess) return res.status(403).json({ error: "Access denied" });
        } else if (userRole === "PROPERTY_OWNER") {
          const hasAccess = await poHasGuestAccess(userId!, guestId);
          if (!hasAccess) return res.status(403).json({ error: "Access denied" });
        } else {
          return res.status(403).json({ error: "Access denied" });
        }
      }
    }

    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, guestId))
      .orderBy(messages.createdAt)
      .limit(200);

    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/chat/:guestId/messages ───────────────────

router.post("/:guestId/messages", messageLimiter, async (req: Request, res: Response) => {
  try {
    const { guestId } = req.params;
    const { content } = req.body;
    const { userId, userRole } = req.session;

    if (!content?.trim()) {
      return res.status(400).json({ error: "Message content is required" });
    }

    // Non-admin users can only post to their own conversation, or PM/PO with booking access
    if ((PORTAL_ROLES as readonly string[]).includes(userRole!)) {
      const myGuestId = await getGuestIdForUser(userId!);
      if (myGuestId !== guestId) {
        if (userRole === "PROPERTY_MANAGER" || userRole === "PM_TEAM_MEMBER") {
          const pmId = await resolvePmId(userId!, userRole!);
          const hasAccess = await pmHasGuestAccess(pmId, guestId);
          if (!hasAccess) return res.status(403).json({ error: "Access denied" });
        } else if (userRole === "PROPERTY_OWNER") {
          const hasAccess = await poHasGuestAccess(userId!, guestId);
          if (!hasAccess) return res.status(403).json({ error: "Access denied" });
        } else {
          return res.status(403).json({ error: "Access denied" });
        }
      }
    }

    const [msg] = await db
      .insert(messages)
      .values({
        conversationId: guestId,
        senderId: userId!,
        senderRole: userRole!,
        content: sanitize(content),
      })
      .returning();

    // Send notification
    try {
      const [senderUser] = await db.select({ fullName: users.fullName }).from(users).where(eq(users.id, userId!)).limit(1);
      const senderName = senderUser?.fullName || "A user";

      if (userRole === "SUPER_ADMIN") {
        // SA → notify the guest
        await createNotification({
          userId: guestId,
          type: "NEW_MESSAGE",
          title: "New message from NestQuest Support",
          body: content.trim().slice(0, 100),
          linkUrl: "/portal/messages",
          relatedId: msg.id,
        });
      } else if (userRole === "PROPERTY_MANAGER" || userRole === "PM_TEAM_MEMBER") {
        // PM → notify the guest
        await createNotification({
          userId: guestId,
          type: "NEW_MESSAGE",
          title: `New message from ${senderName}`,
          body: content.trim().slice(0, 100),
          linkUrl: "/portal/messages",
          relatedId: msg.id,
        });
      } else if (userRole === "PROPERTY_OWNER") {
        // PO → notify the guest
        await createNotification({
          userId: guestId,
          type: "NEW_MESSAGE",
          title: `New message from ${senderName} (Property Owner)`,
          body: content.trim().slice(0, 100),
          linkUrl: "/portal/messages",
          relatedId: msg.id,
        });
      } else {
        // Guest/portal user → notify all super admins
        const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "SUPER_ADMIN"));
        for (const admin of admins) {
          await createNotification({
            userId: admin.id,
            type: "NEW_MESSAGE",
            title: `New message from ${senderName}`,
            body: content.trim().slice(0, 100),
            linkUrl: `/admin/messages/chat?user=${guestId}`,
            relatedId: msg.id,
          });
        }
      }
    } catch {}

    // Audit log
    try {
      await db.insert(userAuditLog).values({
        userId: userId!,
        action: "MESSAGE_SENT",
        details: userRole === "SUPER_ADMIN"
          ? `Admin support message sent to guest ${guestId}`
          : `Support message sent`,
        metadata: JSON.stringify({ messageId: msg.id, conversationId: guestId, type: "support" }),
        ipAddress: req.ip,
      });
    } catch {}

    return res.status(201).json(msg);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── PATCH /api/chat/:guestId/read ──────────────────────
// Mark all messages NOT sent by current user as read

router.patch("/:guestId/read", async (req: Request, res: Response) => {
  try {
    const { guestId } = req.params;
    const { userId } = req.session;

    await db
      .update(messages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(messages.conversationId, guestId),
          ne(messages.senderId, userId!),
          isNull(messages.readAt)
        )
      );

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/chat/conversations ────────────────────────
// Admin: list all conversations with latest message + unread count
// Guest: redirect to their own guestId

router.get("/conversations", async (req: Request, res: Response) => {
  try {
    const { userId, userRole } = req.session;

    if ((PORTAL_ROLES as readonly string[]).includes(userRole!)) {
      const guestId = await getGuestIdForUser(userId!);
      if (!guestId) return res.json([]);

      const guestRows = await db.execute(sql`
        SELECT
          m.conversation_id AS "guestId",
          COALESCE(
            (SELECT u2.full_name FROM users u2
             JOIN messages m2 ON m2.sender_id = u2.id
             WHERE m2.conversation_id = m.conversation_id
               AND m2.sender_role = 'PROPERTY_MANAGER'
             LIMIT 1),
            'NestQuest Support'
          ) AS "fullName",
          COALESCE(
            (SELECT u.email FROM users u
             JOIN messages m2 ON m2.sender_id = u.id
             WHERE m2.conversation_id = m.conversation_id
               AND m2.sender_role = 'PROPERTY_MANAGER'
             LIMIT 1),
            ''
          ) AS email,
          (SELECT content FROM messages WHERE conversation_id = m.conversation_id ORDER BY created_at DESC LIMIT 1) AS "lastMessage",
          (SELECT created_at FROM messages WHERE conversation_id = m.conversation_id ORDER BY created_at DESC LIMIT 1) AS "lastMessageAt",
          COUNT(CASE WHEN m.read_at IS NULL AND m.sender_id != ${userId} THEN 1 END)::int AS "unreadCount"
        FROM messages m
        WHERE m.conversation_id = ${guestId}
        GROUP BY m.conversation_id
      `);
      return res.json(guestRows.rows);
    }

    // Admin: distinct conversations with metadata
    const rows = await db.execute(sql`
      SELECT
        m.conversation_id AS "guestId",
        u.full_name AS "fullName",
        u.email AS email,
        u.role AS "userRole",
        (SELECT content FROM messages WHERE conversation_id = m.conversation_id ORDER BY created_at DESC LIMIT 1) AS "lastMessage",
        (SELECT created_at FROM messages WHERE conversation_id = m.conversation_id ORDER BY created_at DESC LIMIT 1) AS "lastMessageAt",
        COUNT(CASE WHEN m.read_at IS NULL AND m.sender_role != 'SUPER_ADMIN' THEN 1 END)::int AS "unreadCount"
      FROM messages m
      JOIN users u ON u.id = m.conversation_id
      WHERE EXISTS (SELECT 1 FROM users u2 WHERE u2.id = m.conversation_id)
      GROUP BY m.conversation_id, u.full_name, u.email, u.role
      ORDER BY "lastMessageAt" DESC
    `);

    return res.json(rows.rows);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/chat/unread-count ─────────────────────────

router.get("/unread-count", async (req: Request, res: Response) => {
  try {
    const { userId, userRole } = req.session;

    if ((PORTAL_ROLES as readonly string[]).includes(userRole!)) {
      const guestId = await getGuestIdForUser(userId!);
      // Admin support chat unread
      let adminUnread = 0;
      if (guestId) {
        const [r] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(messages)
          .where(and(eq(messages.conversationId, guestId), isNull(messages.readAt), ne(messages.senderId, userId!)));
        adminUnread = r.count;
      }
      // DM unread: messages in conversations matching accepted link IDs where sender is not me
      const dmResult = await db.execute(sql`
        SELECT COUNT(*)::int AS count
        FROM messages m
        WHERE m.conversation_id IN (
          SELECT l.id FROM pm_po_links l
          WHERE (l.pm_user_id = ${userId!} OR l.target_user_id = ${userId!})
          AND l.status = 'accepted'
        )
        AND m.sender_id != ${userId!}
        AND m.read_at IS NULL
      `);
      const dmUnread = (dmResult.rows[0] as any)?.count ?? 0;
      return res.json({ count: adminUnread + dmUnread });
    }

    // Admin: conversations with any unread non-admin messages
    const [result] = await db.execute(sql`
      SELECT COUNT(DISTINCT conversation_id)::int AS count
      FROM messages
      WHERE read_at IS NULL AND sender_role != 'SUPER_ADMIN'
    `);
    return res.json({ count: (result as any).count ?? 0 });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/chat/users ───────────────────────────────
// Admin only: list all portal users for starting new conversations

router.get("/users", async (req: Request, res: Response) => {
  try {
    const { userRole } = req.session;
    if (userRole !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Admin only" });
    }

    const rows = await db.execute(sql`
      SELECT
        u.id AS "guestId",
        u.full_name AS "fullName",
        u.email AS email,
        u.role AS "userRole"
      FROM users u
      WHERE u.status = 'active' AND u.full_name IS NOT NULL
      ORDER BY u.full_name ASC
    `);

    return res.json(rows.rows);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
