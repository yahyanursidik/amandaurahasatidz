-- Idempotent migration. Existing announcements retain LEGACY_HTML; all new drafts explicitly use PLAIN_TEXT.
ALTER TABLE "event_announcements" ADD COLUMN IF NOT EXISTS "email_subject" text;
--> statement-breakpoint
ALTER TABLE "event_announcements" ADD COLUMN IF NOT EXISTS "send_email_notification" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "event_announcements" ADD COLUMN IF NOT EXISTS "content_format" text NOT NULL DEFAULT 'LEGACY_HTML';
--> statement-breakpoint
ALTER TABLE "announcement_recipients" ADD COLUMN IF NOT EXISTS "rendered_title" text;
--> statement-breakpoint
ALTER TABLE "announcement_recipients" ADD COLUMN IF NOT EXISTS "rendered_body" text;
--> statement-breakpoint
-- Legacy republishes could create duplicate grants. Retain the earliest row (and any read marker).
UPDATE "announcement_recipients" AS keeper SET read_at = duplicate.latest_read
FROM (SELECT announcement_id, participant_id, max(read_at) AS latest_read FROM "announcement_recipients"
  WHERE participant_id IS NOT NULL GROUP BY announcement_id, participant_id HAVING count(*) > 1) AS duplicate
WHERE keeper.announcement_id = duplicate.announcement_id AND keeper.participant_id = duplicate.participant_id;
--> statement-breakpoint
DELETE FROM "announcement_recipients" AS duplicate USING "announcement_recipients" AS keeper
WHERE duplicate.announcement_id = keeper.announcement_id AND duplicate.participant_id = keeper.participant_id
  AND duplicate.id > keeper.id;
--> statement-breakpoint
UPDATE "announcement_recipients" AS keeper SET read_at = duplicate.latest_read
FROM (SELECT announcement_id, user_id, max(read_at) AS latest_read FROM "announcement_recipients"
  WHERE user_id IS NOT NULL GROUP BY announcement_id, user_id HAVING count(*) > 1) AS duplicate
WHERE keeper.announcement_id = duplicate.announcement_id AND keeper.user_id = duplicate.user_id;
--> statement-breakpoint
DELETE FROM "announcement_recipients" AS duplicate USING "announcement_recipients" AS keeper
WHERE duplicate.announcement_id = keeper.announcement_id AND duplicate.user_id = keeper.user_id
  AND duplicate.id > keeper.id;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_announcement_participant" ON "announcement_recipients" ("announcement_id", "participant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_announcement_user" ON "announcement_recipients" ("announcement_id", "user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_communication_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "category" text NOT NULL DEFAULT 'CUSTOM',
  "title" text NOT NULL,
  "body" text NOT NULL,
  "email_subject" text,
  "audience_type" text NOT NULL DEFAULT 'ALL_PARTICIPANTS',
  "send_email_notification" boolean NOT NULL DEFAULT false,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "archived_at" timestamptz
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_communication_templates_event" ON "event_communication_templates" ("event_id", "archived_at");