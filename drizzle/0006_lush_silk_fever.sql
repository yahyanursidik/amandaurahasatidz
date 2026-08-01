ALTER TABLE "event_participants" ADD COLUMN "qr_token_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "event_participants" ADD COLUMN "qr_issued_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_participants" ADD COLUMN "qr_rotated_at" timestamp with time zone;