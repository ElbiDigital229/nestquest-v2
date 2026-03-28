import { Router, Request, Response } from "express";
import { db } from "../db/index";
import { messages, guests, users, pmPoLinks, userAuditLog, PORTAL_ROLES } from "../../shared/schema";
import { eq, and, isNull, ne, sql, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { createNotification } from "../utils/notify";
import { checkPlanLimit } from "../middleware/plan-limits";

const router = Router();

router.use(requireAuth);

// ── Helper: resolve guestId for a user ─────────────────

async function getGuestIdForUser(userId: string): Promise<string | null> {
  const [guest] = await db.select({ id: guests.id }).from(guests).where(eq(guests.userId, userId)).limit(1);
  return guest?.id ?? null;
}

// ══════════════════════════════════════════════════════
// DM routes — must be registered BEFORE /:guestId routes
// ══════════════════════════════════════════════════════

async function validateDmAccess(linkId: string, userId: string) {
  const [link] = await db
    .select()
    .from(pmPoLinks)
    .where(and(eq(pmPoLinks.id, linkId), eq(pmPoLinks.status, "accepted")))
    .limit(1);
  if (!link) return null;
  if (link.pmUserId !== userId && link.targetUserId !== userId) return null;
  return link;
}

router.get("/dm/conversations", async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;
    const rows = await db.execute(sql`
      SELECT
        l.id AS "linkId",
        CASE WHEN l.pm_user_id = ${userId!} THEN l.target_user_id ELSE l.pm_user_id END AS "otherUserId",
        CASE WHEN l.pm_user_id = ${userId!} THEN l.target_role ELSE 'PROPERTY_MANAGER' END AS "otherRole",
        g.full_name AS "otherName",
        u.email AS "otherEmail",
        (SELECT content FROM messages WHERE conversation_id = l.id ORDER BY created_at DESC LIMIT 1) AS "lastMessage",
        (SELECT created_at FROM messages WHERE conversation_id = l.id ORDER BY created_at DESC LIMIT 1) AS "lastMessageAt",
        (SELECT COUNT(*)::int FROM messages WHERE conversation_id = l.id AND sender_id != ${userId!} AND read_at IS NULL) AS "unreadCount"
      FROM pm_po_links l
      JOIN users u ON u.id = CASE WHEN l.pm_user_id = ${userId!} THEN l.target_user_id ELSE l.pm_user_id END
      LEFT JOIN guests g ON g.user_id = u.id
      WHERE (l.pm_user_id = ${userId!} OR l.target_user_id = ${userId!})
      AND l.status = 'accepted'
      ORDER BY "lastMessageAt" DESC NULLS LAST
    `);
    return res.json(rows.rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
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
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/dm/:linkId/messages", async (req: Request, res: Response) => {
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
      content: content.trim(),
    }).returning();

    try {
      const otherUserId = link.pmUserId === userId ? link.targetUserId : link.pmUserId;
      const [senderGuest] = await db.select({ fullName: guests.fullName }).from(guests).where(eq(guests.userId, userId!)).limit(1);
      const senderName = senderGuest?.fullName || "A user";
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
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
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
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
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

    // Non-admin users can only access their own conversation
    if ((PORTAL_ROLES as readonly string[]).includes(userRole!)) {
      const myGuestId = await getGuestIdForUser(userId!);
      if (myGuestId !== guestId) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, guestId))
      .orderBy(messages.createdAt)
      .limit(200);

    return res.json(rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── POST /api/chat/:guestId/messages ───────────────────

router.post("/:guestId/messages", async (req: Request, res: Response) => {
  try {
    const { guestId } = req.params;
    const { content } = req.body;
    const { userId, userRole } = req.session;

    if (!content?.trim()) {
      return res.status(400).json({ error: "Message content is required" });
    }

    // Non-admin users can only post to their own conversation
    if ((PORTAL_ROLES as readonly string[]).includes(userRole!)) {
      const myGuestId = await getGuestIdForUser(userId!);
      if (myGuestId !== guestId) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    const [msg] = await db
      .insert(messages)
      .values({
        conversationId: guestId,
        senderId: userId!,
        senderRole: userRole!,
        content: content.trim(),
      })
      .returning();

    // Send notification
    try {
      if (userRole === "SUPER_ADMIN") {
        // Admin sent message → notify the guest's user
        const [guest] = await db.select({ userId: guests.userId }).from(guests).where(eq(guests.id, guestId)).limit(1);
        if (guest) {
          await createNotification({
            userId: guest.userId,
            type: "NEW_MESSAGE",
            title: "New message from NestQuest Support",
            body: content.trim().slice(0, 100),
            linkUrl: "/portal/messages",
            relatedId: msg.id,
          });
        }
      } else {
        // Portal user sent message → notify all super admins
        const [senderGuest] = await db.select({ fullName: guests.fullName }).from(guests).where(eq(guests.userId, userId!)).limit(1);
        const senderName = senderGuest?.fullName || "A user";
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
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
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
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
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
          'NestQuest Support' AS "fullName",
          '' AS email,
          (SELECT content FROM messages WHERE conversation_id = m.conversation_id ORDER BY created_at DESC LIMIT 1) AS "lastMessage",
          (SELECT created_at FROM messages WHERE conversation_id = m.conversation_id ORDER BY created_at DESC LIMIT 1) AS "lastMessageAt",
          COUNT(CASE WHEN m.read_at IS NULL AND m.sender_role = 'SUPER_ADMIN' THEN 1 END)::int AS "unreadCount"
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
        g.full_name AS "fullName",
        u.email AS email,
        u.role AS "userRole",
        (SELECT content FROM messages WHERE conversation_id = m.conversation_id ORDER BY created_at DESC LIMIT 1) AS "lastMessage",
        (SELECT created_at FROM messages WHERE conversation_id = m.conversation_id ORDER BY created_at DESC LIMIT 1) AS "lastMessageAt",
        COUNT(CASE WHEN m.read_at IS NULL AND m.sender_role != 'SUPER_ADMIN' THEN 1 END)::int AS "unreadCount"
      FROM messages m
      JOIN guests g ON g.id = m.conversation_id
      JOIN users u ON u.id = g.user_id
      GROUP BY m.conversation_id, g.full_name, u.email, u.role
      ORDER BY "lastMessageAt" DESC
    `);

    return res.json(rows.rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
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
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
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
        g.id AS "guestId",
        g.full_name AS "fullName",
        u.email AS email,
        u.role AS "userRole"
      FROM guests g
      JOIN users u ON u.id = g.user_id
      WHERE u.status = 'active'
      ORDER BY g.full_name ASC
    `);

    return res.json(rows.rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
