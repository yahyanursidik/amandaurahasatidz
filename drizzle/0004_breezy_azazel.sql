ALTER TABLE "events" ADD COLUMN "poster_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "poster_alt" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "poster_focal_point" text DEFAULT 'CENTER' NOT NULL;