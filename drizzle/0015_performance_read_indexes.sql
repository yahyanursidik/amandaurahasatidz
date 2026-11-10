-- Optional read-performance indexes. No row, quota, or permission changes.
CREATE INDEX IF NOT EXISTS "idx_participants_ustadz" ON "event_participants" ("ustadz_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_participants_event_created" ON "event_participants" ("event_id", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_participant_history_latest" ON "participant_status_histories" ("participant_id", "status_type", "to_status", "changed_at" DESC, "id" DESC);
--> statement-breakpoint
-- Repair older deployments missing indexes already declared in the ORM schema.
CREATE INDEX IF NOT EXISTS "idx_ustadz_norm_name" ON "ustadz_profiles" ("normalized_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ustadz_phone" ON "ustadz_profiles" ("phone");
