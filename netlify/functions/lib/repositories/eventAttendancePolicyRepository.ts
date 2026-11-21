import { eq, sql } from "drizzle-orm";
import { getDbClient } from "../db/client";
import { eventAttendancePolicies } from "../db/schema";

export async function readManualAttendancePolicy(eventId: string, db = getDbClient()) {
  const { rows } = await db.execute<{ available: boolean }>(
    sql`select to_regclass('public.event_attendance_policies') is not null as available`,
  );
  if (!rows[0]?.available) return { available: false, allowUnconfirmedManual: false };
  const [policy] = await db.select({ allowUnconfirmedManual: eventAttendancePolicies.allowUnconfirmedManual })
    .from(eventAttendancePolicies).where(eq(eventAttendancePolicies.eventId, eventId)).limit(1);
  return { available: true, allowUnconfirmedManual: policy?.allowUnconfirmedManual ?? false };
}
