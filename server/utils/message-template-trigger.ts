import { db } from "../db/index";
import { sql } from "drizzle-orm";
import { messages } from "../../shared/schema";
import { createNotification } from "./notify";

type TriggerEvent = "booking_confirmed" | "check_in_day" | "day_before_checkout" | "post_checkout";

interface TriggerContext {
  pmUserId: string;
  guestUserId: string;
  guestName: string;
  propertyName: string;
  propertyAddress?: string;
  pmName?: string;
  pmPhone?: string;
  checkInDate: string;
  checkOutDate: string;
  checkInTime?: string;
  checkOutTime?: string;
  nights?: number;
  totalAmount?: string;
  accessPin?: string | null;
  bookingId: string;
}

function substituteVariables(body: string, ctx: TriggerContext): string {
  const checkIn = new Date(ctx.checkInDate + "T00:00:00");
  const checkOut = new Date(ctx.checkOutDate + "T00:00:00");
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return body
    .replace(/\{\{guest_name\}\}/g, ctx.guestName)
    .replace(/\{\{property_name\}\}/g, ctx.propertyName)
    .replace(/\{\{property_address\}\}/g, ctx.propertyAddress || "")
    .replace(/\{\{check_in_date\}\}/g, fmt(checkIn))
    .replace(/\{\{check_out_date\}\}/g, fmt(checkOut))
    .replace(/\{\{access_pin\}\}/g, ctx.accessPin || "TBD")
    .replace(/\{\{pm_name\}\}/g, ctx.pmName || "Your Property Manager")
    .replace(/\{\{pm_phone\}\}/g, ctx.pmPhone || "")
    .replace(/\{\{booking_id\}\}/g, ctx.bookingId.slice(0, 8).toUpperCase())
    .replace(/\{\{check_in_time\}\}/g, ctx.checkInTime || "15:00")
    .replace(/\{\{check_out_time\}\}/g, ctx.checkOutTime || "12:00")
    .replace(/\{\{nights\}\}/g, ctx.nights?.toString() || "")
    .replace(/\{\{total_nights\}\}/g, ctx.nights?.toString() || "")
    .replace(/\{\{total_amount\}\}/g, ctx.totalAmount || "");
}

export async function fireTrigger(event: TriggerEvent, ctx: TriggerContext): Promise<void> {
  try {
    // Find active templates for this PM with the matching trigger
    const templatesResult = await db.execute(sql`
      SELECT id, name, body, trigger_delay_hours
      FROM message_templates
      WHERE pm_user_id = ${ctx.pmUserId}
        AND trigger = ${event}::message_trigger
        AND is_active = true
      ORDER BY created_at ASC
    `);

    if (templatesResult.rows.length === 0) return;

    // conversation_id is users.id
    const conversationId = ctx.guestUserId;

    for (const template of templatesResult.rows as any[]) {
      // Deduplication: skip if this template was already sent for this booking+trigger
      const alreadySent = await db.execute(sql`
        SELECT 1 FROM message_template_sends
        WHERE template_id = ${template.id}
          AND booking_id = ${ctx.bookingId}
          AND trigger = ${event}::message_trigger
        LIMIT 1
      `);
      if (alreadySent.rows.length > 0) {
        console.log(`[MessageTemplateTrigger] Skipping duplicate: template=${template.id} booking=${ctx.bookingId} event=${event}`);
        continue;
      }

      const body = substituteVariables(template.body, ctx);
      const delayMs = (template.trigger_delay_hours || 0) * 60 * 60 * 1000;

      const send = async () => {
        await db.insert(messages).values({
          conversationId,
          senderId: ctx.pmUserId,
          senderRole: "PROPERTY_MANAGER",
          content: body,
        });

        // Record that this template has been sent for this booking
        await db.execute(sql`
          INSERT INTO message_template_sends (id, template_id, booking_id, trigger)
          VALUES (gen_random_uuid()::text, ${template.id}, ${ctx.bookingId}, ${event}::message_trigger)
        `);

        await createNotification({
          userId: ctx.guestUserId,
          type: "NEW_MESSAGE",
          title: "New message from your Property Manager",
          body: body.slice(0, 120) + (body.length > 120 ? "…" : ""),
          linkUrl: `/portal/messages`,
          relatedId: ctx.bookingId,
        });
      };

      if (delayMs > 0) {
        setTimeout(send, delayMs);
      } else {
        await send();
      }
    }
  } catch (err) {
    console.error("[MessageTemplateTrigger] Failed to fire trigger:", event, err);
  }
}
