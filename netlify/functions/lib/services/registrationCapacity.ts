import { and, count, eq, inArray, notInArray, sql } from "drizzle-orm";
import type { getDbClient } from "../db/client";
import { events, eventParticipants } from "../db/schema";
import { ConflictError, ForbiddenError, NotFoundError } from "../utils/errors";
import { isRegularRegistrationSource, quotaForSource, assertQuotaCoversApproved, assertValidQuotaAllocation } from "./eventQuota";

type Database = ReturnType<typeof getDbClient>;
const regularSources = ["DIRECT_PUBLIC", "DIRECT_ADMIN_UPLOAD", "ADMIN_ENTRY"];

/** All capacity-changing writers lock the same event row before any participant. */
export async function lockRegistrationEvent(tx: Database, eventId: string) {
  const [event] = await tx.select().from(events).where(eq(events.id, eventId)).limit(1).for("update");
  if (!event) throw new NotFoundError("Event tidak ditemukan.");
  if (event.archivedAt || ["ARCHIVED", "COMPLETED", "CANCELLED"].includes(event.status)) {
    throw new ForbiddenError("Data peserta event ini sudah dikunci karena selesai, dibatalkan, atau diarsipkan.");
  }
  return event;
}

/** Must run inside the transaction holding lockRegistrationEvent's row lock. */
export async function assertRegistrationCapacity(tx: Database, event: typeof events.$inferSelect, source: string, additional: number) {
  if (additional <= 0) return;
  const sourceCondition = isRegularRegistrationSource(source)
    ? inArray(eventParticipants.registrationSource, regularSources)
    : notInArray(eventParticipants.registrationSource, regularSources);
  const [usage] = await tx.select({ total: count(), source: sql<number>`coalesce(sum(case when ${sourceCondition} then 1 else 0 end), 0)::int` })
    .from(eventParticipants).where(and(eq(eventParticipants.eventId, event.id), eq(eventParticipants.approvalStatus, "APPROVED"),
      notInArray(eventParticipants.confirmationStatus, ["CANCELLED", "REPLACED"])));
  const limit = quotaForSource(event, source);
  if (event.capacity != null && Number(usage?.total || 0) + additional > event.capacity ||
    limit != null && Number(usage?.source || 0) + additional > limit) {
    throw new ConflictError("Sisa kuota tidak cukup. Kurangi peserta, gunakan daftar tunggu, atau sesuaikan kuota event.");
  }
}

export async function assertRegistrationQuotaEdit(tx: Database, event: typeof events.$inferSelect) {
  assertValidQuotaAllocation(event);
  const [usage] = await tx.select({ total: count(), regular: sql<number>`coalesce(sum(case when ${inArray(eventParticipants.registrationSource, regularSources)} then 1 else 0 end), 0)::int` })
    .from(eventParticipants).where(and(eq(eventParticipants.eventId, event.id), eq(eventParticipants.approvalStatus, "APPROVED"),
      notInArray(eventParticipants.confirmationStatus, ["CANCELLED", "REPLACED"])));
  const total = Number(usage?.total || 0), regular = Number(usage?.regular || 0);
  assertQuotaCoversApproved(event, { total, regular, invitation: total - regular });
}
