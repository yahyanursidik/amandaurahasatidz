-- Standalone, manually applied migration. Not registered in the Drizzle journal.
-- Independent private communication; no event dependencies or public anonymous board.
CREATE TABLE IF NOT EXISTS "ruang_asatidz_threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "category" text NOT NULL,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "share_experience" boolean DEFAULT false NOT NULL,
  "status" text DEFAULT 'NEW' NOT NULL,
  "publication_status" text DEFAULT 'PRIVATE' NOT NULL,
  "published_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "ruang_threads_category_check" CHECK ("category" IN ('SUGGESTION', 'EXPERIENCE', 'NEED', 'QUESTION')),
  CONSTRAINT "ruang_threads_status_check" CHECK ("status" IN ('NEW', 'READ', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  CONSTRAINT "ruang_threads_publication_check" CHECK ("publication_status" IN ('PRIVATE', 'PENDING', 'PUBLISHED', 'HIDDEN')),
  CONSTRAINT "ruang_threads_consent_check" CHECK (
    (NOT "share_experience" OR "category" = 'EXPERIENCE') AND
    ("publication_status" = 'PRIVATE' OR ("share_experience" AND "category" = 'EXPERIENCE'))
  ),
  CONSTRAINT "ruang_threads_published_at_check" CHECK ("publication_status" <> 'PUBLISHED' OR "published_at" IS NOT NULL),
  CONSTRAINT "ruang_threads_content_check" CHECK (length(trim("subject")) BETWEEN 5 AND 160 AND length(trim("body")) BETWEEN 10 AND 5000)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ruang_asatidz_replies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "thread_id" uuid NOT NULL REFERENCES "ruang_asatidz_threads"("id") ON DELETE CASCADE,
  "author_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "author_role" text NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "ruang_replies_role_check" CHECK ("author_role" IN ('ASATIDZ', 'YTS')),
  CONSTRAINT "ruang_replies_body_check" CHECK (length(trim("body")) BETWEEN 2 AND 5000)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ruang_asatidz_greetings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "is_published" boolean DEFAULT false NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "ruang_greetings_content_check" CHECK (length(trim("title")) BETWEEN 5 AND 160 AND length(trim("body")) BETWEEN 10 AND 5000)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ruang_threads_user_created" ON "ruang_asatidz_threads" ("user_id", "created_at", "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ruang_threads_status_created" ON "ruang_asatidz_threads" ("status", "created_at", "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ruang_threads_category_created" ON "ruang_asatidz_threads" ("category", "created_at", "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ruang_threads_board" ON "ruang_asatidz_threads" ("published_at", "id") WHERE "publication_status" = 'PUBLISHED' AND "category" = 'EXPERIENCE' AND "share_experience" = true;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ruang_replies_thread_created" ON "ruang_asatidz_replies" ("thread_id", "created_at", "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ruang_replies_author" ON "ruang_asatidz_replies" ("author_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ruang_greetings_published_created" ON "ruang_asatidz_greetings" ("is_published", "created_at", "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ruang_greetings_created_by" ON "ruang_asatidz_greetings" ("created_by");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ruang_greetings_updated_by" ON "ruang_asatidz_greetings" ("updated_by");