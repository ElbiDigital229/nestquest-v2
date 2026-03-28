import { db } from "../db/index";
import { notifications } from "../../shared/schema";

export async function createNotification(params: {
  userId: string;
  type: "LINK_INVITE" | "LINK_ACCEPTED" | "LINK_REJECTED" | "LINK_REMOVED" | "NEW_MESSAGE" | "USER_SIGNUP" | "KYC_SUBMISSION" | "PLAN_ASSIGNED" | "INVOICE_CREATED" | "INVOICE_OVERDUE";
  title: string;
  body?: string;
  linkUrl?: string;
  relatedId?: string;
}): Promise<void> {
  await db.insert(notifications).values({
    userId: params.userId,
    type: params.type,
    title: params.title,
    body: params.body ?? null,
    linkUrl: params.linkUrl ?? null,
    relatedId: params.relatedId ?? null,
  });
}
