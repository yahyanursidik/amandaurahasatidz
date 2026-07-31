import { getDbClient } from "../netlify/functions/lib/db/client";
import { sql } from "drizzle-orm";
import { logInfo } from "../netlify/functions/lib/utils/logger";

export async function resetDevDatabase() {
  const requestId = `reset_dev_${Date.now()}`;
  logInfo(requestId, "Memulai pembersihan aman (reset) tabel-tabel development database...");

  const db = getDbClient();

  // Cascade truncation of non-production tables
  await db.execute(sql`
    TRUNCATE TABLE 
      checkin_logs,
      attendance_records,
      checkin_tokens,
      announcement_recipients,
      event_announcements,
      email_deliveries,
      email_jobs,
      event_participants,
      invitation_responses,
      invitation_links,
      invitations,
      event_sessions,
      event_days,
      event_committee_assignments,
      events,
      ustadz_institution_affiliations,
      institution_representatives,
      ustadz_profiles,
      institutions,
      sessions,
      users,
      roles
    RESTART IDENTITY CASCADE;
  `);

  logInfo(requestId, "Development database berhasil dibersihkan (reset) 100%.");
  return { status: "SUCCESS", message: "Development database telah di-reset dan siap untuk re-seed baseline." };
}
