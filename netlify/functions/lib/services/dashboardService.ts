import { sql } from "drizzle-orm";
import { getDbClient } from "../db/client";

/** Independent scalar aggregates share one database round trip and snapshot. */
export async function getAdminDashboardMetricsService() {
  const result = await getDbClient().execute(sql`
    select
      (select count(*)::int from events where status in ('PUBLISHED','REGISTRATION_OPEN','REGISTRATION_CLOSED','ONGOING')) as "activeEventsCount",
      (select count(*)::int from institutions where deleted_at is null) as "invitedInstitutionsCount",
      (select count(*)::int from ustadz_profiles where deleted_at is null) as "asatidzProfilesCount",
      (select count(*)::int from ustadz_profiles where deleted_at is not null) as "archivedProfilesCount",
      (select count(*)::int from events where status = 'REGISTRATION_OPEN') as "openRegistrationsCount",
      (select count(*)::int from email_jobs where status in ('QUEUED','PENDING')) as "queuedEmailsCount",
      (select count(*)::int from invitation_responses) as "totalResponsesCount",
      (select count(*)::int from event_participants where approval_status = 'APPROVED') as "approvedParticipantsCount",
      (select count(*)::int from event_participants where approval_status = 'PENDING_REVIEW') as "pendingParticipantsCount",
      (select jsonb_build_object('id', e.id, 'name', e.name) from events e
        where exists (select 1 from event_participants p where p.event_id = e.id and p.approval_status = 'PENDING_REVIEW')
        order by e.start_date desc, e.id desc limit 1) as "pendingEvent",
      (select count(*)::int from attendance_records where attendance_status = 'PRESENT') as "totalAttendedCount",
      (select count(*)::int from email_jobs where status in ('FAILED','DEAD_LETTER')) as "failedEmailsCount",
      coalesce((select jsonb_agg(recent) from (
        select id, code, name, status, start_date as "startDate", end_date as "endDate" from events
        where status in ('DRAFT','PUBLISHED','REGISTRATION_OPEN','REGISTRATION_CLOSED','ONGOING')
        order by case status when 'ONGOING' then 0 when 'REGISTRATION_OPEN' then 1 when 'PUBLISHED' then 2 when 'REGISTRATION_CLOSED' then 3 else 4 end,
          start_date desc, id desc limit 4
      ) recent), '[]'::jsonb) as "recentEvents"
  `);
  return result.rows[0] as unknown as {
    activeEventsCount: number; invitedInstitutionsCount: number; asatidzProfilesCount: number;
    archivedProfilesCount: number; openRegistrationsCount: number; queuedEmailsCount: number;
    totalResponsesCount: number; approvedParticipantsCount: number; pendingParticipantsCount: number;
    pendingEvent: { id: string; name: string } | null; totalAttendedCount: number; failedEmailsCount: number;
    recentEvents: Array<{ id: string; code: string; name: string; status: string; startDate: string; endDate: string }>;
  };
}

export async function getCommitteeDashboardMetricsService(eventId?: string) {
  const scope = eventId ? sql`event_id = ${eventId}::uuid` : sql`true`;
  const result = await getDbClient().execute(sql`
    select
      (select count(*)::int from event_participants where ${scope}) as "totalParticipantsCount",
      coalesce((select jsonb_agg(recent) from (
        select id, result, created_at as "createdAt" from checkin_logs where ${scope}
        order by created_at desc, id desc limit 10
      ) recent), '[]'::jsonb) as "recentCheckins",
      (select count(*)::int from checkin_logs where ${scope} and result = 'FAILED') as "checkinIssuesCount",
      (select count(*)::int from checkin_logs where ${scope} and result = 'DUPLICATE') as "duplicateScansCount",
      (select count(*)::int from event_participants p where ${scope} and confirmation_status = 'CONFIRMED'
        and not exists (select 1 from attendance_records a where a.participant_id = p.id
          and a.attendance_status in ('PRESENT','LATE'))) as "noShowParticipantsCount"
  `);
  return result.rows[0] as unknown as {
    totalParticipantsCount: number; recentCheckins: Array<{ id: string; result: string; createdAt: string }>;
    checkinIssuesCount: number; duplicateScansCount: number; noShowParticipantsCount: number;
  };
}
