-- Internal coordination notes are separate from public/profile/event fields.
CREATE TABLE IF NOT EXISTS ustadz_yts_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 ustadz_id uuid NOT NULL REFERENCES ustadz_profiles(id),
 title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 200),
 body text NOT NULL CHECK (length(trim(body)) BETWEEN 3 AND 10000),
 flag text NOT NULL CHECK (flag IN ('BLUE','YELLOW','RED','GREEN')),
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 archived_at timestamptz,
 created_by uuid NOT NULL REFERENCES users(id),
 updated_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_ustadz_yts_notes_profile ON ustadz_yts_notes(ustadz_id, archived_at, updated_at, id);