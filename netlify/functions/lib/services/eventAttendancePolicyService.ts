import { eq } from "drizzle-orm";
import { getDbClient } from "../db/client";
import { auditLogs, eventAttendancePolicies, events } from "../db/schema";
import { withTransaction } from "../db/transaction";
import { readManualAttendancePolicy } from "../repositories/eventAttendancePolicyRepository";
import { AppError, ConflictError, NotFoundError } from "../utils/errors";

const eventPolicyFields = { status: events.status, archivedAt: events.archivedAt, confirmationRequired: events.attendanceConfirmationRequired };
const canEdit = (event: { status: string; archivedAt: Date | null }) =>
  !event.archivedAt && !["ARCHIVED", "CANCELLED"].includes(event.status);

export async function getEventAttendancePolicyService(eventId: string) {
  const db = getDbClient();
  const [event] = await db.select(eventPolicyFields).from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) throw new NotFoundError("Event tidak ditemukan.");
  return { ...await readManualAttendancePolicy(eventId, db), confirmationRequired: event.confirmationRequired, editable: canEdit(event) };
}

export async function updateEventAttendancePolicyService(eventId: string, allowUnconfirmedManual: boolean, actorUserId: string, requestId: string) {
  return withTransaction(async (tx) => {
    const [event] = await tx.select(eventPolicyFields).from(events).where(eq(events.id, eventId)).limit(1).for("update");
    if (!event) throw new NotFoundError("Event tidak ditemukan.");
    if (!canEdit(event)) throw new ConflictError("Pengaturan presensi untuk event ini sudah ditutup.");
    const before = await readManualAttendancePolicy(eventId, tx);
    if (!before.available) throw new AppError("Pengaturan presensi manual menunggu migrasi database.", 503, "ATTENDANCE_POLICY_UNAVAILABLE");
    if (before.allowUnconfirmedManual !== allowUnconfirmedManual) {
      await tx.insert(eventAttendancePolicies).values({ eventId, allowUnconfirmedManual })
        .onConflictDoUpdate({ target: eventAttendancePolicies.eventId, set: { allowUnconfirmedManual } });
      await tx.insert(auditLogs).values({ actorUserId, eventId, resourceType: "EVENT", resourceId: eventId,
        action: "EVENT_MANUAL_ATTENDANCE_POLICY_UPDATED", requestId,
        beforeData: { allowUnconfirmedManual: before.allowUnconfirmedManual }, afterData: { allowUnconfirmedManual } });
    }
    return { available: true, allowUnconfirmedManual, confirmationRequired: event.confirmationRequired, editable: true };
  });
}
