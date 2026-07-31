ALTER TABLE "events" ADD COLUMN "invitation_response_deadline" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "attendance_confirmation_deadline" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "attendance_confirmation_required" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "late_confirmation_policy" text DEFAULT 'BLOCK' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_committee_event_user_role" ON "event_committee_assignments" USING btree ("event_id","user_id","committee_role");