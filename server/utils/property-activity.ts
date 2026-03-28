import { db } from "../db/index";
import { sql } from "drizzle-orm";

export async function logPropertyActivity(
  propertyId: string,
  userId: string,
  action: string,
  description: string,
  metadata?: Record<string, any>
) {
  try {
    const id = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO st_property_activity_log (id, property_id, user_id, action, description, metadata, created_at)
      VALUES (${id}, ${propertyId}, ${userId}, ${sql.raw(`'${action}'::st_activity_action`)}, ${description}, ${metadata ? JSON.stringify(metadata) : null}, NOW())
    `);
  } catch (err) {
    // Don't let activity logging errors break the main flow
    console.error("[PropertyActivity] Failed to log:", err);
  }
}
