CREATE TABLE IF NOT EXISTS "event_attendance_policies" (
  "event_id" uuid PRIMARY KEY REFERENCES "events"("id") ON DELETE CASCADE,
  "allow_unconfirmed_manual" boolean NOT NULL DEFAULT false
);
