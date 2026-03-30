import { Router, Request, Response } from "express";
import { db } from "../db/index";
import { users, guests, userAuditLog, pmPoLinks, messages, subscriptions, plans, invoices, documentTypes, userDocuments, stProperties, stPropertyPhotos, stPropertyAmenities, stPropertyPolicies, stPropertyDocuments, stAcquisitionDetails, stPaymentSchedules, areas } from "../../shared/schema";
import { eq, and, like, or, sql, gte, lte, asc, desc, ne } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth";
import { createNotification } from "../utils/notify";
import { sanitize } from "../utils/sanitize";

const router = Router();

// All routes require SUPER_ADMIN
router.use(requireAuth, requireRole("SUPER_ADMIN"));

// ── List Guests ────────────────────────────────────────

router.get("/users", async (req: Request, res: Response) => {
  try {
    const {
      search,
      kycStatus,
      userStatus,
      nationality,
      role,
      dateFrom,
      dateTo,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = "1",
      limit = "20",
    } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Build WHERE conditions
    const conditions: any[] = [ne(users.role, "SUPER_ADMIN")];

    if (search) {
      const term = `%${search}%`;
      conditions.push(
        or(
          like(guests.fullName, term),
          like(users.email, term),
          like(users.phone, term)
        )
      );
    }
    if (kycStatus) conditions.push(eq(guests.kycStatus, kycStatus as string));
    if (userStatus) conditions.push(eq(users.status, userStatus as string));
    if (nationality) conditions.push(like(guests.nationality, `%${nationality}%`));
    if (role) conditions.push(eq(users.role, role as string));
    if (dateFrom) conditions.push(gte(guests.createdAt, new Date(dateFrom as string)));
    if (dateTo) {
      const end = new Date(dateTo as string);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(guests.createdAt, end));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Build ORDER BY
    const orderMap: Record<string, any> = {
      fullName: guests.fullName,
      email: users.email,
      nationality: guests.nationality,
      kycStatus: guests.kycStatus,
      userStatus: users.status,
      createdAt: guests.createdAt,
    };
    const orderCol = orderMap[sortBy as string] ?? guests.createdAt;
    const orderFn = sortOrder === "asc" ? asc : desc;

    const results = await db
      .select({
        id: guests.id,
        userId: guests.userId,
        fullName: guests.fullName,
        email: users.email,
        phone: users.phone,
        nationality: guests.nationality,
        countryOfResidence: guests.countryOfResidence,
        dob: guests.dob,
        emiratesIdNumber: guests.emiratesIdNumber,
        kycStatus: guests.kycStatus,
        userStatus: users.status,
        role: users.role,
        createdAt: guests.createdAt,
      })
      .from(guests)
      .innerJoin(users, eq(guests.userId, users.id))
      .where(where)
      .orderBy(orderFn(orderCol))
      .limit(parseInt(limit as string))
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(guests)
      .innerJoin(users, eq(guests.userId, users.id))
      .where(where);

    return res.json({
      guests: results,
      total: countResult.count,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Get Guest Detail ───────────────────────────────────

router.get("/users/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [guest] = await db
      .select()
      .from(guests)
      .where(eq(guests.id, id))
      .limit(1);

    if (!guest) {
      return res.status(404).json({ error: "Guest not found" });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, guest.userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      },
      profile: guest,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Update Guest Profile (Admin) ──────────────────────

router.patch("/users/:id/profile", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { fullName, dob, nationality, countryOfResidence, residentAddress, emiratesIdNumber, emiratesIdExpiry, phone, emiratesIdFrontUrl, emiratesIdBackUrl } = req.body;

    const [guest] = await db.select().from(guests).where(eq(guests.id, id)).limit(1);
    if (!guest) {
      return res.status(404).json({ error: "Guest not found" });
    }

    // Validate required fields are not blank if provided
    const requiredFields = ["fullName", "dob", "nationality", "countryOfResidence", "residentAddress", "emiratesIdNumber", "emiratesIdExpiry"];
    for (const field of requiredFields) {
      if (field in req.body && (req.body[field] === "" || req.body[field] === null)) {
        return res.status(400).json({ error: `${field} cannot be empty` });
      }
    }

    // Sanitize string inputs to prevent stored XSS
    const safeBody: Record<string, any> = { ...req.body };
    for (const k of ["fullName", "nationality", "countryOfResidence", "residentAddress", "emiratesIdNumber", "phone"]) {
      if (typeof safeBody[k] === "string") safeBody[k] = sanitize(safeBody[k]);
    }

    // Update guest profile fields
    const guestUpdates: Record<string, any> = {};
    if (safeBody.fullName !== undefined && safeBody.fullName !== "") guestUpdates.fullName = safeBody.fullName;
    if (dob !== undefined && dob !== "") guestUpdates.dob = dob;
    if (safeBody.nationality !== undefined && safeBody.nationality !== "") guestUpdates.nationality = safeBody.nationality;
    if (safeBody.countryOfResidence !== undefined && safeBody.countryOfResidence !== "") guestUpdates.countryOfResidence = safeBody.countryOfResidence;
    if (safeBody.residentAddress !== undefined && safeBody.residentAddress !== "") guestUpdates.residentAddress = safeBody.residentAddress;
    if (safeBody.emiratesIdNumber !== undefined && safeBody.emiratesIdNumber !== "") guestUpdates.emiratesIdNumber = safeBody.emiratesIdNumber;
    if (emiratesIdExpiry !== undefined && emiratesIdExpiry !== "") guestUpdates.emiratesIdExpiry = emiratesIdExpiry;
    if (emiratesIdFrontUrl) guestUpdates.emiratesIdFrontUrl = emiratesIdFrontUrl;
    if (emiratesIdBackUrl) guestUpdates.emiratesIdBackUrl = emiratesIdBackUrl;

    if (Object.keys(guestUpdates).length > 0) {
      guestUpdates.updatedAt = new Date();
      await db.update(guests).set(guestUpdates).where(eq(guests.id, id));
    }

    // Update phone on users table if provided
    if (safeBody.phone) {
      await db.update(users).set({ phone: safeBody.phone, updatedAt: new Date() }).where(eq(users.id, guest.userId));
    }

    // Audit log
    await db.insert(userAuditLog).values({
      userId: guest.userId,
      action: "PROFILE_UPDATED",
      details: `Profile updated by admin`,
      metadata: JSON.stringify({ fields: [...Object.keys(guestUpdates), ...(phone ? ["phone"] : [])], changedBy: req.session.userId }),
      ipAddress: req.ip,
    });

    return res.json({ message: "Guest profile updated successfully" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Get Guest Activity ─────────────────────────────────

router.get("/users/:id/activity", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get the guest to find userId
    const [guest] = await db.select().from(guests).where(eq(guests.id, id)).limit(1);
    if (!guest) {
      return res.status(404).json({ error: "Guest not found" });
    }

    const logs = await db
      .select()
      .from(userAuditLog)
      .where(eq(userAuditLog.userId, guest.userId))
      .orderBy(userAuditLog.createdAt)
      .limit(100);

    return res.json(logs.reverse());
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Update Guest Status ────────────────────────────────

router.patch("/users/:id/status", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "suspended"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const [guest] = await db.select().from(guests).where(eq(guests.id, id)).limit(1);
    if (!guest) {
      return res.status(404).json({ error: "Guest not found" });
    }

    await db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, guest.userId));

    // Audit log
    await db.insert(userAuditLog).values({
      userId: guest.userId,
      action: "STATUS_CHANGED",
      details: `Status changed to ${status} by admin`,
      metadata: JSON.stringify({ newStatus: status, changedBy: req.session.userId }),
      ipAddress: req.ip,
    });

    return res.json({ message: `Guest status updated to ${status}` });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Update KYC Status ──────────────────────────────────

router.patch("/users/:id/kyc", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { kycStatus } = req.body;

    if (!["pending", "verified", "rejected"].includes(kycStatus)) {
      return res.status(400).json({ error: "Invalid KYC status" });
    }

    const [guest] = await db.select().from(guests).where(eq(guests.id, id)).limit(1);
    if (!guest) {
      return res.status(404).json({ error: "Guest not found" });
    }

    await db.update(guests).set({ kycStatus, updatedAt: new Date() }).where(eq(guests.id, id));

    const actionMap = { verified: "KYC_VERIFIED" as const, rejected: "KYC_REJECTED" as const, pending: "KYC_SUBMITTED" as const };

    await db.insert(userAuditLog).values({
      userId: guest.userId,
      action: actionMap[kycStatus as keyof typeof actionMap],
      details: `KYC status changed to ${kycStatus} by admin`,
      metadata: JSON.stringify({ newKycStatus: kycStatus, changedBy: req.session.userId }),
      ipAddress: req.ip,
    });

    return res.json({ message: `KYC status updated to ${kycStatus}` });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Distinct Nationalities ─────────────────────────────

router.get("/nationalities", async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .selectDistinct({ nationality: guests.nationality })
      .from(guests)
      .where(sql`${guests.nationality} is not null and ${guests.nationality} != ''`)
      .orderBy(asc(guests.nationality));
    return res.json(rows.map((r) => r.nationality));
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Dashboard Stats ────────────────────────────────────

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const [guestCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(guests);

    const [activeCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(and(ne(users.role, "SUPER_ADMIN"), eq(users.status, "active")));

    const [suspendedCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(and(ne(users.role, "SUPER_ADMIN"), eq(users.status, "suspended")));

    const [kycPending] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(guests)
      .where(eq(guests.kycStatus, "pending"));

    return res.json({
      totalGuests: guestCount.count,
      activeGuests: activeCount.count,
      suspendedGuests: suspendedCount.count,
      kycPending: kycPending.count,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Conversations for a user (SA reads messages) ────────

router.get("/users/:id/conversations", async (req: Request, res: Response) => {
  try {
    const guestId = req.params.id;

    // Find the userId for this guestId
    const [guest] = await db
      .select({ userId: guests.userId })
      .from(guests)
      .where(eq(guests.id, guestId))
      .limit(1);
    if (!guest) return res.status(404).json({ error: "Guest not found" });
    const targetUserId = guest.userId;

    const conversations: any[] = [];

    // 1) Admin support conversation (conversationId = guestId)
    const adminMsgs = await db.execute(sql`
      SELECT COUNT(*)::int AS "messageCount",
        MAX(created_at) AS "lastMessageAt",
        (SELECT content FROM messages WHERE conversation_id = ${guestId} ORDER BY created_at DESC LIMIT 1) AS "lastMessage"
      FROM messages
      WHERE conversation_id = ${guestId}
    `);
    const admin = (adminMsgs.rows as any[])[0];
    if (admin && admin.messageCount > 0) {
      conversations.push({
        id: guestId,
        type: "admin",
        otherName: "Admin Support",
        otherEmail: "",
        otherRole: "SUPER_ADMIN",
        lastMessage: admin.lastMessage,
        lastMessageAt: admin.lastMessageAt,
        messageCount: admin.messageCount,
      });
    }

    // 2) DM conversations (links where user is participant)
    const dmRows = await db.execute(sql`
      SELECT
        l.id AS "linkId",
        CASE WHEN l.pm_user_id = ${targetUserId} THEN l.target_user_id ELSE l.pm_user_id END AS "otherUserId",
        CASE WHEN l.pm_user_id = ${targetUserId} THEN l.target_role ELSE 'PROPERTY_MANAGER' END AS "otherRole",
        g.full_name AS "otherName",
        u.email AS "otherEmail",
        (SELECT content FROM messages WHERE conversation_id = l.id ORDER BY created_at DESC LIMIT 1) AS "lastMessage",
        (SELECT created_at FROM messages WHERE conversation_id = l.id ORDER BY created_at DESC LIMIT 1) AS "lastMessageAt",
        (SELECT COUNT(*)::int FROM messages WHERE conversation_id = l.id) AS "messageCount"
      FROM pm_po_links l
      JOIN users u ON u.id = CASE WHEN l.pm_user_id = ${targetUserId} THEN l.target_user_id ELSE l.pm_user_id END
      LEFT JOIN guests g ON g.user_id = u.id
      WHERE (l.pm_user_id = ${targetUserId} OR l.target_user_id = ${targetUserId})
      AND l.status = 'accepted'
      ORDER BY "lastMessageAt" DESC NULLS LAST
    `);

    for (const row of dmRows.rows as any[]) {
      if (row.messageCount > 0) {
        conversations.push({
          id: row.linkId,
          type: "dm",
          otherName: row.otherName || row.otherEmail,
          otherEmail: row.otherEmail,
          otherRole: row.otherRole,
          lastMessage: row.lastMessage,
          lastMessageAt: row.lastMessageAt,
          messageCount: row.messageCount,
        });
      }
    }

    // Sort by lastMessageAt desc
    conversations.sort((a, b) => {
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    return res.json(conversations);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Document Types ───────────────────────────────────────

router.get("/document-types", async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(documentTypes)
      .where(eq(documentTypes.isActive, true))
      .orderBy(documentTypes.sortOrder);
    return res.json(rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Compliance endpoint ─────────────────────────────────

router.get("/compliance", async (req: Request, res: Response) => {
  try {
    const { role, search } = req.query;

    const whereClauses: ReturnType<typeof sql>[] = [];
    whereClauses.push(sql`u.role NOT IN ('SUPER_ADMIN', 'PM_TEAM_MEMBER')`);

    if (role && role !== "all") {
      whereClauses.push(sql`u.role = ${role as string}`);
    }
    if (search) {
      const term = `%${search}%`;
      whereClauses.push(sql`(g.full_name ILIKE ${term} OR u.email ILIKE ${term})`);
    }

    const whereSQL = whereClauses.length > 0
      ? sql`WHERE ${sql.join(whereClauses, sql` AND `)}`
      : sql``;

    // Build documents array using actual document_types IDs for correct matching
    const rows = await db.execute(sql`
      SELECT
        u.id AS "userId",
        g.id AS "guestId",
        g.full_name AS "fullName",
        u.email,
        u.role,
        json_build_array(
          json_build_object(
            'documentTypeId', (SELECT id FROM document_types WHERE slug = 'emirates_id' LIMIT 1),
            'slug', 'emirates_id',
            'label', 'Emirates ID',
            'fileUrl', CASE WHEN g.emirates_id_front_url IS NOT NULL OR g.emirates_id_back_url IS NOT NULL THEN COALESCE(g.emirates_id_front_url, g.emirates_id_back_url) ELSE NULL END,
            'documentNumber', g.emirates_id_number,
            'expiryDate', g.emirates_id_expiry,
            'hasExpiry', true
          ),
          json_build_object(
            'documentTypeId', (SELECT id FROM document_types WHERE slug = 'passport' LIMIT 1),
            'slug', 'passport',
            'label', 'Passport',
            'fileUrl', g.passport_front_url,
            'documentNumber', g.passport_number,
            'expiryDate', g.passport_expiry,
            'hasExpiry', true
          ),
          json_build_object(
            'documentTypeId', (SELECT id FROM document_types WHERE slug = 'trade_license' LIMIT 1),
            'slug', 'trade_license',
            'label', 'Trade License',
            'fileUrl', g.trade_license_url,
            'documentNumber', NULL,
            'expiryDate', g.trade_license_expiry,
            'hasExpiry', true
          )
        ) AS documents
      FROM users u
      JOIN guests g ON g.user_id = u.id
      ${whereSQL}
      ORDER BY g.full_name ASC
    `);

    return res.json(rows.rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── PM's subscription (SA view) ─────────────────────────

router.get("/users/:id/subscription", async (req: Request, res: Response) => {
  try {
    const guestId = req.params.id;
    const [guest] = await db.select({ userId: guests.userId }).from(guests).where(eq(guests.id, guestId)).limit(1);
    if (!guest) return res.status(404).json({ error: "Guest not found" });

    // First try active/trial, then fall back to most recent (cancelled/expired)
    let subRows = await db.execute(sql`
      SELECT s.*, p.name AS "planName", p.price AS "planPrice", p.billing_cycle AS "planBillingCycle"
      FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = ${guest.userId} AND s.status IN ('active', 'trial', 'pending_payment')
      ORDER BY s.created_at DESC
      LIMIT 1
    `);
    if (!subRows.rows.length) {
      subRows = await db.execute(sql`
        SELECT s.*, p.name AS "planName", p.price AS "planPrice", p.billing_cycle AS "planBillingCycle"
        FROM subscriptions s
        JOIN plans p ON p.id = s.plan_id
        WHERE s.user_id = ${guest.userId}
        ORDER BY s.created_at DESC
        LIMIT 1
      `);
    }

    const invoiceRows = await db.execute(sql`
      SELECT i.*, p.name AS "planName"
      FROM invoices i
      JOIN plans p ON p.id = i.plan_id
      WHERE i.user_id = ${guest.userId}
      ORDER BY i.created_at DESC
    `);

    return res.json({
      subscription: subRows.rows[0] || null,
      invoices: invoiceRows.rows,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.patch("/users/:id/subscription", async (req: Request, res: Response) => {
  try {
    const guestId = req.params.id;
    const { planId } = req.body;

    const [guest] = await db.select({ userId: guests.userId }).from(guests).where(eq(guests.id, guestId)).limit(1);
    if (!guest) return res.status(404).json({ error: "Guest not found" });

    const [plan] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    if (!plan.isActive) return res.status(400).json({ error: "Cannot assign an inactive plan" });

    const result = await db.transaction(async (tx) => {
      // Cancel existing active/trial/pending_payment subscription
      await tx.execute(sql`
        UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
        WHERE user_id = ${guest.userId} AND status IN ('active', 'trial', 'pending_payment')
      `);

      // Refund any pending invoices from cancelled subscription
      await tx.execute(sql`
        UPDATE invoices SET invoice_status = 'refunded', paid_at = NULL
        WHERE user_id = ${guest.userId} AND invoice_status = 'pending'
      `);

      const now = new Date();
      const periodEnd = new Date(now);
      if (plan.billingCycle === "monthly") periodEnd.setMonth(periodEnd.getMonth() + 1);
      else if (plan.billingCycle === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      else if (plan.billingCycle === "custom" && plan.customCycleDays) periodEnd.setDate(periodEnd.getDate() + plan.customCycleDays);
      else periodEnd.setFullYear(periodEnd.getFullYear() + 100); // one_time

      const isFree = parseFloat(plan.price) === 0;
      const status = isFree ? "active" : "pending_payment";

      const [sub] = await tx.insert(subscriptions).values({
        userId: guest.userId,
        planId: plan.id,
        status,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      }).returning();

      const [invoice] = await tx.insert(invoices).values({
        subscriptionId: sub.id,
        userId: guest.userId,
        planId: plan.id,
        amount: plan.price,
        status: isFree ? "paid" : "pending",
        billingPeriodStart: now,
        billingPeriodEnd: periodEnd,
        paidAt: isFree ? now : null,
      }).returning();

      // Audit log
      await tx.insert(userAuditLog).values({
        userId: guest.userId,
        action: "SETTINGS_UPDATED",
        details: `Plan assigned to ${plan.name} by admin${isFree ? "" : " (pending payment)"}`,
        metadata: JSON.stringify({ planId, planName: plan.name, changedBy: req.session.userId }),
        ipAddress: req.ip,
      });

      return { sub, invoice, isFree };
    });

    // Notify PM if paid plan — they need to complete payment (outside tx, non-critical)
    if (!result.isFree) {
      await createNotification({
        userId: guest.userId,
        type: "PLAN_ASSIGNED",
        title: `You've been assigned the ${plan.name} plan`,
        body: `An admin assigned you the ${plan.name} plan (AED ${plan.price}/${plan.billingCycle}). Complete payment to activate your subscription.`,
        linkUrl: "/portal/settings",
        relatedId: result.sub.id,
      });
    }

    return res.json({ subscription: result.sub, invoice: result.invoice });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Cancel PM's subscription (SA action) ─────────────

router.post("/users/:id/subscription/cancel", async (req: Request, res: Response) => {
  try {
    const guestId = req.params.id;
    const [guest] = await db.select({ userId: guests.userId }).from(guests).where(eq(guests.id, guestId)).limit(1);
    if (!guest) return res.status(404).json({ error: "Guest not found" });

    const rows = await db.execute(sql`
      SELECT s.id, s.status, p.name AS "planName"
      FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = ${guest.userId}
      AND s.status IN ('active', 'trial', 'pending_payment')
      ORDER BY s.created_at DESC
      LIMIT 1
    `);

    if (!rows.rows.length) {
      return res.status(404).json({ error: "No active subscription to cancel" });
    }

    const sub = rows.rows[0] as any;

    await db.transaction(async (tx) => {
      await tx.execute(sql`
        UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
        WHERE id = ${sub.id}
      `);

      await tx.execute(sql`
        UPDATE invoices SET invoice_status = 'refunded', paid_at = NULL
        WHERE subscription_id = ${sub.id} AND invoice_status = 'pending'
      `);
    });

    return res.json({ message: `Subscription to ${sub.planName} has been cancelled` });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── Transactions / Revenue ───────────────────────────

router.get("/transactions", async (req: Request, res: Response) => {
  try {
    const {
      search,
      status,
      page = "1",
      limit = "20",
    } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const lim = parseInt(limit as string);

    const whereClauses: ReturnType<typeof sql>[] = [];

    if (search) {
      const term = `%${search}%`;
      whereClauses.push(sql`(g.full_name ILIKE ${term} OR u.email ILIKE ${term})`);
    }
    if (status && status !== "all") {
      whereClauses.push(sql`i.invoice_status = ${status as string}`);
    }

    const whereSQL = whereClauses.length > 0
      ? sql`WHERE ${sql.join(whereClauses, sql` AND `)}`
      : sql``;

    // Summary stats
    const statsRows = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN i.invoice_status = 'paid' THEN i.amount::numeric WHEN i.invoice_status = 'refunded' THEN -i.amount::numeric ELSE 0 END), 0) AS "totalRevenue",
        COUNT(*)::int AS "totalTransactions",
        (SELECT COUNT(DISTINCT s.user_id)::int FROM subscriptions s WHERE s.status = 'active') AS "activeSubscribers",
        (SELECT COUNT(DISTINCT s.user_id)::int FROM subscriptions s WHERE s.status = 'trial') AS "trialSubscribers",
        (SELECT COUNT(DISTINCT s.user_id)::int FROM subscriptions s WHERE s.status IN ('active', 'trial')) AS "totalSubscribers"
      FROM invoices i
      JOIN users u ON u.id = i.user_id
      JOIN guests g ON g.user_id = u.id
      ${whereSQL}
    `);

    // Paginated invoices
    const dataRows = await db.execute(sql`
      SELECT i.id, i.amount, i.invoice_status AS "status", i.paid_at AS "paidAt",
             i.created_at AS "createdAt",
             g.full_name AS "userName", u.email AS "userEmail", u.role AS "userRole",
             p.name AS "planName", g.id AS "guestId"
      FROM invoices i
      JOIN users u ON u.id = i.user_id
      JOIN guests g ON g.user_id = u.id
      JOIN plans p ON p.id = i.plan_id
      ${whereSQL}
      ORDER BY i.created_at DESC
      LIMIT ${lim} OFFSET ${offset}
    `);

    // Total count for pagination
    const countRows = await db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM invoices i
      JOIN users u ON u.id = i.user_id
      JOIN guests g ON g.user_id = u.id
      ${whereSQL}
    `);

    return res.json({
      stats: statsRows.rows[0],
      transactions: dataRows.rows,
      total: (countRows.rows[0] as any).total,
      page: parseInt(page as string),
      limit: lim,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── GET /guests/:id/st-properties — List ST properties for a user (PM or PO) ──

router.get("/users/:id/st-properties", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Look up guest to get userId and role
    const [guest] = await db
      .select({ userId: guests.userId })
      .from(guests)
      .where(eq(guests.id, id))
      .limit(1);

    if (!guest) {
      return res.status(404).json({ error: "Guest not found" });
    }

    const userId = guest.userId;

    // Get the user's role
    const [user] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let whereClause: any;
    if (user.role === "PROPERTY_MANAGER") {
      whereClause = sql`p.pm_user_id = ${userId}`;
    } else if (user.role === "PROPERTY_OWNER") {
      whereClause = sql`p.po_user_id = ${userId}`;
    } else {
      return res.json([]);
    }

    const results = await db.execute(sql`
      SELECT
        p.id,
        p.public_name AS "publicName",
        p.status,
        p.property_type AS "propertyType",
        p.city,
        a.name AS "area",
        p.bedrooms,
        p.bathrooms,
        p.nightly_rate AS "nightlyRate",
        p.po_user_id AS "poUserId",
        p.pm_user_id AS "pmUserId",
        ph.url AS "coverPhotoUrl",
        COALESCE(photo_counts.cnt, 0)::int AS "photosCount",
        p.created_at AS "createdAt",
        p.updated_at AS "updatedAt"
      FROM st_properties p
      LEFT JOIN areas a ON a.id = p.area_id
      LEFT JOIN st_property_photos ph ON ph.property_id = p.id AND ph.is_cover = true
      LEFT JOIN (
        SELECT property_id, COUNT(*)::int AS cnt FROM st_property_photos GROUP BY property_id
      ) photo_counts ON photo_counts.property_id = p.id
      WHERE ${whereClause}
      ORDER BY p.updated_at DESC
    `);

    return res.json(results.rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── GET /st-properties/:id — View a single ST property (SA read-only) ──

router.get("/st-properties/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [property] = await db
      .select()
      .from(stProperties)
      .where(eq(stProperties.id, id))
      .limit(1);

    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }

    // Get area name
    let areaName: string | null = null;
    if (property.areaId) {
      const [area] = await db.select({ name: areas.name }).from(areas).where(eq(areas.id, property.areaId)).limit(1);
      areaName = area?.name || null;
    }

    // Fetch related data in parallel
    const [photos, amenities, policies, documents, acquisitionRows, paymentSchedules] = await Promise.all([
      db.select().from(stPropertyPhotos).where(eq(stPropertyPhotos.propertyId, id)).orderBy(stPropertyPhotos.displayOrder),
      db.select().from(stPropertyAmenities).where(eq(stPropertyAmenities.propertyId, id)),
      db.select().from(stPropertyPolicies).where(eq(stPropertyPolicies.propertyId, id)).orderBy(stPropertyPolicies.displayOrder),
      db.select().from(stPropertyDocuments).where(eq(stPropertyDocuments.propertyId, id)),
      db.select().from(stAcquisitionDetails).where(eq(stAcquisitionDetails.propertyId, id)).limit(1),
      db.select().from(stPaymentSchedules).where(eq(stPaymentSchedules.propertyId, id)).orderBy(stPaymentSchedules.displayOrder),
    ]);

    // Get PM and PO names
    let pmName: string | null = null;
    let poName: string | null = null;
    if (property.pmUserId) {
      const [pm] = await db.select({ fullName: guests.fullName, email: users.email }).from(users).innerJoin(guests, eq(guests.userId, users.id)).where(eq(users.id, property.pmUserId)).limit(1);
      pmName = pm?.fullName || pm?.email || null;
    }
    if (property.poUserId) {
      const [po] = await db.select({ fullName: guests.fullName, email: users.email }).from(users).innerJoin(guests, eq(guests.userId, users.id)).where(eq(users.id, property.poUserId)).limit(1);
      poName = po?.fullName || po?.email || null;
    }

    return res.json({
      ...property,
      areaName,
      pmName,
      poName,
      photosCount: photos.length,
      agreementConfirmed: property.confirmed,
      photos,
      amenities: amenities.map(a => a.amenityKey),
      policies,
      documents,
      acquisitionDetails: acquisitionRows[0] || null,
      paymentSchedules,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════════════
// BOOKINGS, REVIEWS & TRANSACTIONS (Admin view)
// ══════════════════════════════════════════════════════

// All bookings across the platform
router.get("/bookings", async (req: Request, res: Response) => {
  try {
    const { status, propertyId } = req.query;
    let statusFilter = sql``;
    if (status && status !== "all") statusFilter = sql` AND b.status = ${status as string}`;
    let propFilter = sql``;
    if (propertyId) propFilter = sql` AND b.property_id = ${propertyId as string}`;

    const result = await db.execute(sql`
      SELECT b.id, b.status, b.source,
        b.check_in_date AS "checkInDate", b.check_out_date AS "checkOutDate",
        b.number_of_guests AS "numberOfGuests", b.total_nights AS "totalNights",
        b.total_amount AS "totalAmount", b.security_deposit_amount AS "securityDepositAmount",
        b.commission_amount AS "commissionAmount", b.owner_payout_amount AS "ownerPayoutAmount",
        b.payment_method AS "paymentMethod", b.payment_status AS "paymentStatus",
        b.created_at AS "createdAt",
        p.public_name AS "propertyName", p.city AS "propertyCity",
        COALESCE(g.full_name, b.guest_name, 'Guest') AS "guestName",
        u.email AS "guestEmail",
        pm_g.full_name AS "pmName"
      FROM st_bookings b
      JOIN st_properties p ON p.id = b.property_id
      LEFT JOIN guests g ON g.user_id = b.guest_user_id
      LEFT JOIN users u ON u.id = b.guest_user_id
      LEFT JOIN guests pm_g ON pm_g.user_id = b.pm_user_id
      WHERE 1=1 ${statusFilter} ${propFilter}
      ORDER BY b.created_at DESC
      LIMIT 100
    `);
    return res.json(result.rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Booking detail
router.get("/bookings/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.execute(sql`
      SELECT b.*,
        p.public_name AS "propertyName", p.city AS "propertyCity", p.property_type AS "propertyType",
        COALESCE(g.full_name, b.guest_name) AS "guestName",
        u.email AS "guestEmail", u.phone AS "guestPhone",
        pm_g.full_name AS "pmName", pm_u.email AS "pmEmail",
        po_g.full_name AS "ownerName"
      FROM st_bookings b
      JOIN st_properties p ON p.id = b.property_id
      LEFT JOIN guests g ON g.user_id = b.guest_user_id
      LEFT JOIN users u ON u.id = b.guest_user_id
      LEFT JOIN guests pm_g ON pm_g.user_id = b.pm_user_id
      LEFT JOIN users pm_u ON pm_u.id = b.pm_user_id
      LEFT JOIN guests po_g ON po_g.user_id = p.po_user_id
      WHERE b.id = ${id}
    `);
    if (result.rows.length === 0) return res.status(404).json({ error: "Booking not found" });
    return res.json(result.rows[0]);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// All reviews across the platform
router.get("/reviews", async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT r.id, r.rating, r.title, r.description, r.pm_response AS "pmResponse",
        r.created_at AS "createdAt",
        p.public_name AS "propertyName",
        g.full_name AS "guestName",
        u.email AS "guestEmail",
        pm_g.full_name AS "pmName"
      FROM st_reviews r
      JOIN st_properties p ON p.id = r.property_id
      LEFT JOIN guests g ON g.user_id = r.guest_user_id
      LEFT JOIN users u ON u.id = r.guest_user_id
      LEFT JOIN guests pm_g ON pm_g.user_id = p.pm_user_id
      ORDER BY r.created_at DESC
    `);
    return res.json(result.rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// All settlements across the platform
router.get("/settlements", async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT s.id, s.amount, s.reason, s.status,
        s.paid_at AS "paidAt", s.confirmed_at AS "confirmedAt",
        s.created_at AS "createdAt",
        p.public_name AS "propertyName",
        from_g.full_name AS "fromName",
        to_g.full_name AS "toName",
        e.description AS "expenseDescription",
        COALESCE(guest_g.full_name, b.guest_name) AS "guestName"
      FROM pm_po_settlements s
      JOIN st_properties p ON p.id = s.property_id
      LEFT JOIN st_bookings b ON b.id = s.booking_id
      LEFT JOIN st_property_expenses e ON e.id = s.expense_id
      LEFT JOIN guests from_g ON from_g.user_id = s.from_user_id
      LEFT JOIN guests to_g ON to_g.user_id = s.to_user_id
      LEFT JOIN guests guest_g ON guest_g.user_id = b.guest_user_id
      ORDER BY s.created_at DESC
    `);
    return res.json(result.rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// All properties across the platform
router.get("/properties", async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT p.id, p.public_name AS "publicName", p.status, p.city,
        p.property_type AS "propertyType", p.bedrooms, p.bathrooms,
        p.nightly_rate AS "nightlyRate",
        pm_g.full_name AS "pmName", pm_u.email AS "pmEmail",
        po_g.full_name AS "ownerName",
        (SELECT COUNT(*)::int FROM st_bookings b WHERE b.property_id = p.id) AS "bookingCount",
        (SELECT COUNT(*)::int FROM st_reviews r WHERE r.property_id = p.id) AS "reviewCount",
        (SELECT COALESCE(AVG(r.rating), 0) FROM st_reviews r WHERE r.property_id = p.id) AS "avgRating"
      FROM st_properties p
      LEFT JOIN guests pm_g ON pm_g.user_id = p.pm_user_id
      LEFT JOIN users pm_u ON pm_u.id = p.pm_user_id
      LEFT JOIN guests po_g ON po_g.user_id = p.po_user_id
      ORDER BY p.created_at DESC
    `);
    return res.json(result.rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
