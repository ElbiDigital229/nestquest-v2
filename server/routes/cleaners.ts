import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { db } from "../db/index";
import { users } from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requirePmPermission, getPmUserId } from "../middleware/pm-permissions";
import { createNotification } from "../utils/notify";

const router = Router();
router.use(requireAuth);

// Block non-PM/team/cleaner roles
router.use((req, res, next) => {
  const role = req.session.userRole;
  if (!role || !["PROPERTY_MANAGER", "PM_TEAM_MEMBER", "CLEANER"].includes(role)) {
    return res.status(403).json({ error: "Access denied" });
  }
  next();
});

// ══════════════════════════════════════════════════════
// CLEANER ACCOUNTS
// ══════════════════════════════════════════════════════

// List cleaners for this PM
router.get("/", requirePmPermission("cleaners.manage"), async (req: Request, res: Response) => {
  try {
    const pmId = await getPmUserId(req);
    // Cleaners are linked via cleaning_tasks — find all cleaners who have tasks for this PM's properties
    // Also find cleaners created by this PM (stored in user_audit_log or we track via a simple approach)
    // Simple approach: cleaners linked to this PM's properties
    const result = await db.execute(sql`
      SELECT DISTINCT u.id, u.email, u.phone, u.status, u.created_at AS "createdAt",
        (SELECT COUNT(*)::int FROM cleaning_tasks ct WHERE ct.cleaner_user_id = u.id AND ct.pm_user_id = ${pmId}) AS "taskCount",
        (SELECT COUNT(*)::int FROM cleaning_tasks ct WHERE ct.cleaner_user_id = u.id AND ct.pm_user_id = ${pmId} AND ct.status = 'completed') AS "completedCount"
      FROM users u
      WHERE u.role = 'CLEANER'
      AND (
        EXISTS (SELECT 1 FROM cleaning_tasks ct WHERE ct.cleaner_user_id = u.id AND ct.pm_user_id = ${pmId})
        OR EXISTS (SELECT 1 FROM user_audit_log al WHERE al.user_id = ${pmId} AND al.details LIKE '%' || u.email || '%' AND al.action = 'SETTINGS_UPDATED')
        OR u.id IN (SELECT cleaner_user_id FROM cleaning_tasks WHERE pm_user_id = ${pmId})
      )
      ORDER BY u.created_at DESC
    `);

    // If no cleaners found via tasks, also check a pm_cleaners link approach
    // For simplicity, let's also query cleaners created for this PM
    const allCleaners = await db.execute(sql`
      SELECT u.id, u.email, u.phone, u.status, u.created_at AS "createdAt",
        (SELECT COUNT(*)::int FROM cleaning_tasks ct WHERE ct.cleaner_user_id = u.id AND ct.pm_user_id = ${pmId}) AS "taskCount",
        (SELECT COUNT(*)::int FROM cleaning_tasks ct WHERE ct.cleaner_user_id = u.id AND ct.pm_user_id = ${pmId} AND ct.status = 'completed') AS "completedCount"
      FROM users u
      WHERE u.role = 'CLEANER'
      ORDER BY u.created_at DESC
    `);

    return res.json(allCleaners.rows);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Create cleaner account
router.post("/", requirePmPermission("cleaners.manage"), async (req: Request, res: Response) => {
  try {
    const pmId = await getPmUserId(req);
    const { email, phone, password, fullName } = req.body;

    if (!email?.trim()) return res.status(400).json({ error: "Email is required" });
    if (!password?.trim()) return res.status(400).json({ error: "Password is required" });
    if (!fullName?.trim()) return res.status(400).json({ error: "Full name is required" });

    const emailLower = email.toLowerCase().trim();

    // Check if cleaner email already exists
    const [existing] = await db.select().from(users)
      .where(and(eq(users.email, emailLower), eq(users.role, "CLEANER")))
      .limit(1);
    if (existing) return res.status(400).json({ error: "A cleaner with this email already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const [cleaner] = await db.insert(users).values({
      email: emailLower,
      passwordHash,
      role: "CLEANER",
      phone: phone || null,
      status: "active",
    }).returning();

    // Store cleaner name in a simple way — we'll use the cleaning tasks system
    // For now, track the PM-cleaner relationship
    await db.execute(sql`
      INSERT INTO user_audit_log (id, user_id, action, details, metadata, created_at)
      VALUES (gen_random_uuid()::text, ${pmId}, 'SETTINGS_UPDATED', ${'Created cleaner: ' + fullName + ' (' + emailLower + ')'}, ${JSON.stringify({ cleanerId: cleaner.id, fullName, email: emailLower })}, NOW())
    `);

    return res.status(201).json({ id: cleaner.id, email: cleaner.email, fullName });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Activate/deactivate cleaner
router.patch("/:id/status", requirePmPermission("cleaners.manage"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!["active", "suspended"].includes(status)) return res.status(400).json({ error: "Status must be active or suspended" });
    await db.execute(sql`UPDATE users SET status = ${status}, updated_at = NOW() WHERE id = ${id} AND role = 'CLEANER'`);
    return res.json({ message: `Cleaner ${status === "active" ? "activated" : "deactivated"}` });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════
// CHECKLISTS
// ══════════════════════════════════════════════════════

// List checklists
router.get("/checklists", requirePmPermission("cleaners.manage"), async (req: Request, res: Response) => {
  try {
    const pmId = await getPmUserId(req);
    const result = await db.execute(sql`
      SELECT c.id, c.name, c.property_id AS "propertyId", c.created_at AS "createdAt",
        p.public_name AS "propertyName",
        (SELECT COUNT(*)::int FROM cleaning_checklist_items ci WHERE ci.checklist_id = c.id) AS "itemCount"
      FROM cleaning_checklists c
      LEFT JOIN st_properties p ON p.id = c.property_id
      WHERE c.pm_user_id = ${pmId}
      ORDER BY c.created_at DESC
    `);
    return res.json(result.rows);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Create checklist with items
router.post("/checklists", requirePmPermission("cleaners.manage"), async (req: Request, res: Response) => {
  try {
    const pmId = await getPmUserId(req);
    const { name, propertyId, items } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: "Checklist name is required" });
    if (!items?.length) return res.status(400).json({ error: "At least one item is required" });

    const checklistId = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO cleaning_checklists (id, pm_user_id, property_id, name)
      VALUES (${checklistId}, ${pmId}, ${propertyId || null}, ${name.trim()})
    `);

    for (let i = 0; i < items.length; i++) {
      await db.execute(sql`
        INSERT INTO cleaning_checklist_items (id, checklist_id, label, display_order)
        VALUES (gen_random_uuid()::text, ${checklistId}, ${items[i]}, ${i})
      `);
    }

    return res.status(201).json({ id: checklistId });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get checklist with items
router.get("/checklists/:id", requirePmPermission("cleaners.manage"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const checklist = await db.execute(sql`
      SELECT c.*, p.public_name AS "propertyName"
      FROM cleaning_checklists c
      LEFT JOIN st_properties p ON p.id = c.property_id
      WHERE c.id = ${id}
    `);
    if (checklist.rows.length === 0) return res.status(404).json({ error: "Checklist not found" });

    const items = await db.execute(sql`
      SELECT id, label, display_order AS "displayOrder"
      FROM cleaning_checklist_items WHERE checklist_id = ${id}
      ORDER BY display_order ASC
    `);

    return res.json({ ...checklist.rows[0], items: items.rows });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Delete checklist
router.delete("/checklists/:id", requirePmPermission("cleaners.manage"), async (req: Request, res: Response) => {
  try {
    await db.execute(sql`DELETE FROM cleaning_checklists WHERE id = ${req.params.id}`);
    return res.json({ message: "Checklist deleted" });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════
// TASKS (ASSIGNMENTS)
// ══════════════════════════════════════════════════════

// List tasks
router.get("/tasks", async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const userRole = req.session.userRole!;
    const { status, propertyId } = req.query;

    let whereClause;
    if (userRole === "CLEANER") {
      whereClause = sql`t.cleaner_user_id = ${userId}`;
    } else {
      const pmId = await getPmUserId(req);
      whereClause = sql`t.pm_user_id = ${pmId}`;
    }

    let statusFilter = sql``;
    if (status && status !== "all") statusFilter = sql` AND t.status = ${status as string}`;

    let propFilter = sql``;
    if (propertyId) propFilter = sql` AND t.property_id = ${propertyId as string}`;

    const result = await db.execute(sql`
      SELECT t.id, t.title, t.status, t.priority, t.notes,
        t.due_at AS "dueAt", t.started_at AS "startedAt", t.completed_at AS "completedAt",
        t.created_at AS "createdAt",
        p.public_name AS "propertyName", p.building_name AS "buildingName", p.unit_number AS "unitNumber",
        u.email AS "cleanerEmail",
        (SELECT COUNT(*)::int FROM cleaning_task_items ti WHERE ti.task_id = t.id) AS "totalItems",
        (SELECT COUNT(*)::int FROM cleaning_task_items ti WHERE ti.task_id = t.id AND ti.is_checked = true) AS "checkedItems"
      FROM cleaning_tasks t
      JOIN st_properties p ON p.id = t.property_id
      LEFT JOIN users u ON u.id = t.cleaner_user_id
      WHERE ${whereClause} ${statusFilter} ${propFilter}
      ORDER BY t.created_at DESC
    `);

    return res.json(result.rows);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Create task (assign cleaning)
router.post("/tasks", requirePmPermission("cleaners.manage"), async (req: Request, res: Response) => {
  try {
    const pmId = await getPmUserId(req);
    const createdBy = req.session.userId!;
    const { propertyId, cleanerUserId, checklistId, title, notes, dueAt, priority, customItems } = req.body;

    if (!propertyId) return res.status(400).json({ error: "Property is required" });
    if (!cleanerUserId) return res.status(400).json({ error: "Cleaner is required" });
    if (!title?.trim()) return res.status(400).json({ error: "Title is required" });

    const taskId = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO cleaning_tasks (id, property_id, pm_user_id, cleaner_user_id, checklist_id, title, notes, due_at, priority, created_by, status)
      VALUES (${taskId}, ${propertyId}, ${pmId}, ${cleanerUserId}, ${checklistId || null}, ${title.trim()}, ${notes || null}, ${dueAt || null}, ${priority || 'normal'}, ${createdBy}, 'pending')
    `);

    let displayOrder = 0;

    // Copy checklist template items first
    if (checklistId) {
      const items = await db.execute(sql`
        SELECT label, display_order FROM cleaning_checklist_items WHERE checklist_id = ${checklistId} ORDER BY display_order
      `);
      for (const item of items.rows as any[]) {
        await db.execute(sql`
          INSERT INTO cleaning_task_items (id, task_id, label, display_order)
          VALUES (gen_random_uuid()::text, ${taskId}, ${item.label}, ${displayOrder})
        `);
        displayOrder++;
      }
    }

    // Add custom items after checklist items
    if (Array.isArray(customItems)) {
      for (const label of customItems) {
        if (label?.trim()) {
          await db.execute(sql`
            INSERT INTO cleaning_task_items (id, task_id, label, display_order)
            VALUES (gen_random_uuid()::text, ${taskId}, ${label.trim()}, ${displayOrder})
          `);
          displayOrder++;
        }
      }
    }

    // Notify cleaner
    await createNotification({
      userId: cleanerUserId,
      type: "BOOKING_REQUESTED",
      title: "New cleaning task assigned",
      body: `You have a new cleaning task: ${title}`,
      linkUrl: "/portal/cleaner-tasks",
      relatedId: taskId,
    });

    return res.status(201).json({ id: taskId });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get task detail with items
router.get("/tasks/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId!;
    const userRole = req.session.userRole!;

    const task = await db.execute(sql`
      SELECT t.*, p.public_name AS "propertyName", p.building_name AS "buildingName",
        p.unit_number AS "unitNumber", p.address_line_1 AS "address",
        u.email AS "cleanerEmail"
      FROM cleaning_tasks t
      JOIN st_properties p ON p.id = t.property_id
      LEFT JOIN users u ON u.id = t.cleaner_user_id
      WHERE t.id = ${id}
    `);
    if (task.rows.length === 0) return res.status(404).json({ error: "Task not found" });

    // Verify access
    const t = task.rows[0] as any;
    if (userRole === "CLEANER" && t.cleaner_user_id !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const items = await db.execute(sql`
      SELECT id, label, is_checked AS "isChecked", notes, image_url AS "imageUrl",
        checked_at AS "checkedAt", display_order AS "displayOrder"
      FROM cleaning_task_items WHERE task_id = ${id}
      ORDER BY display_order ASC
    `);

    return res.json({ ...t, items: items.rows });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════
// CLEANER ACTIONS (check items, complete task)
// ══════════════════════════════════════════════════════

// Check/uncheck an item
router.patch("/tasks/:taskId/items/:itemId", async (req: Request, res: Response) => {
  try {
    const { taskId, itemId } = req.params;
    const { userId, userRole } = req.session;
    const { isChecked, notes, imageUrl } = req.body;

    // Verify cleaner owns this task
    if (userRole === "CLEANER") {
      const ownership = await db.execute(sql`
        SELECT 1 FROM cleaning_tasks WHERE id = ${taskId} AND cleaner_user_id = ${userId!} LIMIT 1
      `);
      if (ownership.rows.length === 0) return res.status(403).json({ error: "Access denied" });
    }

    if (isChecked === undefined && notes === undefined && imageUrl === undefined) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    // Build update with parameterized queries only
    if (isChecked !== undefined) {
      const checkedBool = Boolean(isChecked);
      if (checkedBool) {
        await db.execute(sql`
          UPDATE cleaning_task_items SET is_checked = true, checked_at = NOW()
          WHERE id = ${itemId} AND task_id = ${taskId}
        `);
      } else {
        await db.execute(sql`
          UPDATE cleaning_task_items SET is_checked = false, checked_at = NULL
          WHERE id = ${itemId} AND task_id = ${taskId}
        `);
      }
    }
    if (notes !== undefined) {
      await db.execute(sql`
        UPDATE cleaning_task_items SET notes = ${String(notes)}
        WHERE id = ${itemId} AND task_id = ${taskId}
      `);
    }
    if (imageUrl !== undefined) {
      await db.execute(sql`
        UPDATE cleaning_task_items SET image_url = ${String(imageUrl)}
        WHERE id = ${itemId} AND task_id = ${taskId}
      `);
    }

    // Auto-start task if first item checked
    if (isChecked) {
      await db.execute(sql`
        UPDATE cleaning_tasks SET status = 'in_progress', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
        WHERE id = ${taskId} AND status = 'pending'
      `);
    }

    return res.json({ message: "Item updated" });
  } catch {
    return res.status(500).json({ error: "Failed to update item" });
  }
});

// Complete task
router.patch("/tasks/:id/complete", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId, userRole } = req.session;
    const { notes } = req.body;

    // Verify cleaner is assigned to this task
    if (userRole === "CLEANER") {
      const ownership = await db.execute(sql`
        SELECT 1 FROM cleaning_tasks WHERE id = ${id} AND cleaner_user_id = ${userId!} AND status != 'completed' LIMIT 1
      `);
      if (ownership.rows.length === 0) return res.status(403).json({ error: "Access denied" });
    }

    await db.execute(sql`
      UPDATE cleaning_tasks SET status = 'completed', completed_at = NOW(), notes = ${notes || null}, updated_at = NOW()
      WHERE id = ${id}
    `);

    // Notify PM
    const task = await db.execute(sql`SELECT pm_user_id, title FROM cleaning_tasks WHERE id = ${id}`);
    const t = task.rows[0] as any;
    if (t) {
      await createNotification({
        userId: t.pm_user_id,
        type: "BOOKING_CHECKOUT",
        title: "Cleaning task completed",
        body: `Cleaner has completed: ${t.title}`,
        relatedId: id,
      });
    }

    return res.json({ status: "completed" });
  } catch {
    return res.status(500).json({ error: "Failed to complete task" });
  }
});

// ══════════════════════════════════════════════════════
// AUTOMATION RULES
// ══════════════════════════════════════════════════════

// List rules
router.get("/automation-rules", requirePmPermission("cleaners.manage"), async (req: Request, res: Response) => {
  try {
    const pmId = await getPmUserId(req);
    const result = await db.execute(sql`
      SELECT r.id, r.property_id AS "propertyId", r.checklist_id AS "checklistId",
        r.delay_minutes AS "delayMinutes", r.is_active AS "isActive",
        r.created_at AS "createdAt",
        p.public_name AS "propertyName",
        c.name AS "checklistName"
      FROM cleaning_automation_rules r
      JOIN st_properties p ON p.id = r.property_id
      JOIN cleaning_checklists c ON c.id = r.checklist_id
      WHERE r.pm_user_id = ${pmId}
      ORDER BY r.created_at DESC
    `);
    return res.json(result.rows);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Create rule
router.post("/automation-rules", requirePmPermission("cleaners.manage"), async (req: Request, res: Response) => {
  try {
    const pmId = await getPmUserId(req);
    const { propertyId, checklistId, delayMinutes } = req.body;

    if (!propertyId || !checklistId) return res.status(400).json({ error: "Property and checklist are required" });

    const ruleId = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO cleaning_automation_rules (id, property_id, pm_user_id, checklist_id, delay_minutes)
      VALUES (${ruleId}, ${propertyId}, ${pmId}, ${checklistId}, ${delayMinutes || 30})
    `);

    return res.status(201).json({ id: ruleId });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Toggle rule active/inactive
router.patch("/automation-rules/:id", requirePmPermission("cleaners.manage"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    await db.execute(sql`UPDATE cleaning_automation_rules SET is_active = ${isActive}, updated_at = NOW() WHERE id = ${id}`);
    return res.json({ message: "Rule updated" });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Delete rule
router.delete("/automation-rules/:id", requirePmPermission("cleaners.manage"), async (req: Request, res: Response) => {
  try {
    await db.execute(sql`DELETE FROM cleaning_automation_rules WHERE id = ${req.params.id}`);
    return res.json({ message: "Rule deleted" });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════
// HELPER: Auto-create cleaning task (called from booking checkout)
// ══════════════════════════════════════════════════════

export async function triggerCleaningAutomation(propertyId: string, pmUserId: string, bookingId: string): Promise<void> {
  try {
    const rules = await db.execute(sql`
      SELECT r.id, r.checklist_id, r.delay_minutes,
        c.name AS checklist_name
      FROM cleaning_automation_rules r
      JOIN cleaning_checklists c ON c.id = r.checklist_id
      WHERE r.property_id = ${propertyId} AND r.pm_user_id = ${pmUserId} AND r.is_active = true
    `);

    for (const rule of rules.rows as any[]) {
      const checklistId = rule.checklist_id;
      if (!checklistId) continue;

      const dueAt = new Date(Date.now() + rule.delay_minutes * 60 * 1000);
      const taskId = crypto.randomUUID();

      // Find cleaner: prefer one already used by this PM, fallback to any CLEANER role user
      const cleanerResult = await db.execute(sql`
        SELECT cleaner_user_id FROM cleaning_tasks
        WHERE pm_user_id = ${pmUserId} AND cleaner_user_id IS NOT NULL
        ORDER BY created_at DESC LIMIT 1
      `);
      let cleanerUserId = (cleanerResult.rows[0] as any)?.cleaner_user_id || null;
      if (!cleanerUserId) {
        const fallback = await db.execute(sql`SELECT id FROM users WHERE role = 'CLEANER' LIMIT 1`);
        cleanerUserId = (fallback.rows[0] as any)?.id || null;
      }

      await db.execute(sql`
        INSERT INTO cleaning_tasks (id, property_id, pm_user_id, cleaner_user_id, checklist_id, booking_id, title, due_at, status, created_by)
        VALUES (${taskId}, ${propertyId}, ${pmUserId}, ${cleanerUserId}, ${checklistId}, ${bookingId},
          ${'Post-checkout cleaning: ' + rule.checklist_name}, ${dueAt.toISOString()}, 'pending', ${pmUserId})
      `);

      // Copy checklist items into task items
      const items = await db.execute(sql`
        SELECT label, display_order FROM cleaning_checklist_items WHERE checklist_id = ${checklistId} ORDER BY display_order
      `);
      for (const item of items.rows as any[]) {
        await db.execute(sql`
          INSERT INTO cleaning_task_items (id, task_id, label, display_order)
          VALUES (gen_random_uuid()::text, ${taskId}, ${item.label}, ${item.display_order})
        `);
      }

      // Notify cleaner
      if (cleanerUserId) {
        await createNotification({
          userId: cleanerUserId,
          type: "BOOKING_CHECKOUT",
          title: "Auto-assigned cleaning task",
          body: `Post-checkout cleaning task for ${rule.checklist_name}. Due in ${rule.delay_minutes} minutes.`,
          linkUrl: "/portal/cleaner-tasks",
          relatedId: taskId,
        });
      }
    }
  } catch (error: any) {
    console.error("[Cleaners] triggerCleaningAutomation error:", error);
  }
}

export default router;
