import { db } from "../db/index";
import { notifications } from "../../shared/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { createNotification } from "./notify";

/**
 * Check all document expiry dates from the guests table (the actual source of truth).
 * Sends notifications for documents expiring within 30 days or already expired.
 */
export async function checkAllDocumentExpiry(): Promise<void> {
  const now = new Date();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Pull expiry dates from the guests table columns
  const rows = await db.execute(sql`
    SELECT
      u.id AS "userId",
      g.id AS "guestId",
      g.emirates_id_expiry AS "eidExpiry",
      g.passport_expiry AS "passportExpiry",
      g.trade_license_expiry AS "tradeLicenseExpiry"
    FROM users u
    JOIN guests g ON g.user_id = u.id
    WHERE u.role NOT IN ('SUPER_ADMIN', 'PM_TEAM_MEMBER')
  `);

  const docsToCheck: { userId: string; relatedId: string; label: string; expiryDate: Date }[] = [];

  for (const row of rows.rows as any[]) {
    // Use short suffixes to stay within varchar(36): guestId is a UUID (36 chars)
    // so we use a hash-based short ID for dedup
    const shortId = (row.guestId as string).slice(0, 30);
    if (row.eidExpiry) {
      docsToCheck.push({ userId: row.userId, relatedId: `${shortId}:eid`, label: "Emirates ID", expiryDate: new Date(row.eidExpiry) });
    }
    if (row.passportExpiry) {
      docsToCheck.push({ userId: row.userId, relatedId: `${shortId}:pass`, label: "Passport", expiryDate: new Date(row.passportExpiry) });
    }
    if (row.tradeLicenseExpiry) {
      docsToCheck.push({ userId: row.userId, relatedId: `${shortId}:tlic`, label: "Trade License", expiryDate: new Date(row.tradeLicenseExpiry) });
    }
  }

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  let created = 0;
  for (const doc of docsToCheck) {
    // Only process documents expiring within 30 days (or already expired)
    if (doc.expiryDate > thirtyDaysFromNow) continue;

    // Skip if notification already sent in last 24h for this doc
    const [existing] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, doc.userId),
          eq(notifications.relatedId, doc.relatedId),
          gt(notifications.createdAt, oneDayAgo)
        )
      )
      .limit(1);

    if (existing) continue;

    const isExpired = doc.expiryDate <= now;
    const dateStr = doc.expiryDate.toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });

    await createNotification({
      userId: doc.userId,
      type: "KYC_SUBMISSION",
      title: isExpired ? "Document Expired" : "Document Expiring Soon",
      body: isExpired
        ? `${doc.label} has expired`
        : `${doc.label} expires on ${dateStr}`,
      relatedId: doc.relatedId,
    });
    created++;
  }

  console.log(`[Document Expiry Cron] Checked ${docsToCheck.length} documents, created ${created} notifications`);
}
