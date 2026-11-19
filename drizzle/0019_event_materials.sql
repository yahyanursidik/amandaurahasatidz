ALTER TABLE "event_recordings"
  ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'VIDEO' CHECK ("kind" IN ('VIDEO', 'PDF')),
  ADD COLUMN IF NOT EXISTS "alternate_urls" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "session_id" uuid REFERENCES "event_sessions"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_event_recordings_session" ON "event_recordings" ("session_id");

CREATE TABLE IF NOT EXISTS "event_material_progress" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "recording_id" uuid NOT NULL REFERENCES "event_recordings"("id") ON DELETE CASCADE,
  "completed_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "recording_id")
);

CREATE INDEX IF NOT EXISTS "idx_event_material_progress_recording" ON "event_material_progress" ("recording_id");
