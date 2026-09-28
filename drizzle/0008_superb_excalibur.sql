ALTER TABLE "event_participants" ADD COLUMN "public_group_id" uuid;--> statement-breakpoint
ALTER TABLE "event_announcements" ADD COLUMN "target_institution_id" uuid;--> statement-breakpoint
ALTER TABLE "event_announcements" ADD CONSTRAINT "event_announcements_target_institution_id_institutions_id_fk" FOREIGN KEY ("target_institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_participants_public_group" ON "event_participants" USING btree ("event_id","public_group_id");