import { Router, Request, Response } from "express";
import { db } from "../db/index";
import { messageTemplates } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { getPmUserId } from "../middleware/pm-permissions";

const router = Router();
router.use(requireAuth);

async function resolvePmId(req: Request): Promise<string> {
  if (req.session.userRole === "PM_TEAM_MEMBER") return getPmUserId(req);
  return req.session.userId!;
}

// ── GET / — List all templates for this PM ──
router.get("/", async (req: Request, res: Response) => {
  try {
    const pmUserId = await resolvePmId(req);
    const templates = await db
      .select()
      .from(messageTemplates)
      .where(eq(messageTemplates.pmUserId, pmUserId))
      .orderBy(messageTemplates.createdAt);
    return res.json(templates);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST / — Create template ──
router.post("/", async (req: Request, res: Response) => {
  try {
    const pmUserId = await resolvePmId(req);
    const { name, subject, body, trigger, triggerDelayHours, isActive } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
    if (!body?.trim()) return res.status(400).json({ error: "Body is required" });

    const [template] = await db
      .insert(messageTemplates)
      .values({
        pmUserId,
        name: name.trim(),
        subject: subject?.trim() || null,
        body: body.trim(),
        trigger: trigger || "manual",
        triggerDelayHours: triggerDelayHours != null ? parseInt(triggerDelayHours) : 0,
        isActive: isActive !== false,
      })
      .returning();

    return res.status(201).json(template);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── PATCH /:id — Update template ──
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const pmUserId = await resolvePmId(req);
    const { id } = req.params;

    const [existing] = await db
      .select()
      .from(messageTemplates)
      .where(and(eq(messageTemplates.id, id), eq(messageTemplates.pmUserId, pmUserId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Template not found" });

    const { name, subject, body, trigger, triggerDelayHours, isActive } = req.body;

    const [updated] = await db
      .update(messageTemplates)
      .set({
        ...(name !== undefined && { name: name.trim() }),
        ...(subject !== undefined && { subject: subject?.trim() || null }),
        ...(body !== undefined && { body: body.trim() }),
        ...(trigger !== undefined && { trigger }),
        ...(triggerDelayHours !== undefined && { triggerDelayHours: parseInt(triggerDelayHours) }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      })
      .where(and(eq(messageTemplates.id, id), eq(messageTemplates.pmUserId, pmUserId)))
      .returning();

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── DELETE /:id — Delete template ──
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const pmUserId = await resolvePmId(req);
    const { id } = req.params;

    const [deleted] = await db
      .delete(messageTemplates)
      .where(and(eq(messageTemplates.id, id), eq(messageTemplates.pmUserId, pmUserId)))
      .returning({ id: messageTemplates.id });

    if (!deleted) return res.status(404).json({ error: "Template not found" });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
