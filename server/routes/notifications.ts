import { Router, Request, Response } from "express";
import { db } from "../db/index";
import { notifications } from "../../shared/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

// Type filter mapping
const TYPE_FILTERS: Record<string, string[]> = {
  messages: ["NEW_MESSAGE"],
  invites: ["LINK_INVITE", "LINK_ACCEPTED", "LINK_REJECTED", "LINK_REMOVED"],
  system: ["USER_SIGNUP", "KYC_SUBMISSION"],
};

// ── GET /api/notifications ─────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    const typeFilter = req.query.type as string;

    const conditions = [eq(notifications.userId, userId!)];

    if (typeFilter && typeFilter !== "all" && TYPE_FILTERS[typeFilter]) {
      conditions.push(
        inArray(notifications.type, TYPE_FILTERS[typeFilter] as any)
      );
    }

    const rows = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(...conditions));

    return res.json({
      notifications: rows,
      total: countResult.count,
      limit,
      offset,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── GET /api/notifications/unread-count ────────────────
router.get("/unread-count", async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;

    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId!),
          eq(notifications.isRead, false)
        )
      );

    return res.json({ count: result.count });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── PATCH /api/notifications/:id/read ──────────────────
router.patch("/:id/read", async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.id, req.params.id),
          eq(notifications.userId, userId!)
        )
      );

    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ── PATCH /api/notifications/read-all ──────────────────
router.patch("/read-all", async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.userId, userId!),
          eq(notifications.isRead, false)
        )
      );

    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
