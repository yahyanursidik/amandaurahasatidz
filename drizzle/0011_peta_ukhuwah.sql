CREATE TABLE IF NOT EXISTS ukhuwah_locations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), institution_id uuid REFERENCES institutions(id) ON DELETE SET NULL,
 name text NOT NULL, type text NOT NULL CHECK (type IN ('MOSQUE','PESANTREN','FOUNDATION','STUDY_GROUP','EDUCATION','OTHER')),
 address text NOT NULL, city_code text NOT NULL, district text NOT NULL,
 latitude double precision, longitude double precision, programs text NOT NULL DEFAULT '', needs text NOT NULL DEFAULT '',
 is_published boolean NOT NULL DEFAULT false, is_verified boolean NOT NULL DEFAULT false,
 official_phone text NOT NULL DEFAULT '', pic_name text NOT NULL DEFAULT '', pic_phone text NOT NULL DEFAULT '',
 official_contact_shared boolean NOT NULL DEFAULT false, pic_contact_shared boolean NOT NULL DEFAULT false,
 contact_consent_confirmed boolean NOT NULL DEFAULT false, contact_consent_source text NOT NULL DEFAULT '', contact_confirmed_at timestamptz,
 version integer NOT NULL DEFAULT 1 CHECK (version > 0), created_by uuid NOT NULL REFERENCES users(id), updated_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT ukhuwah_location_region CHECK (city_code IN ('3273','3277','3204','3217','3211') AND (city_code <> '3211' OR lower(district) IN ('jatinangor','cimanggung','tanjungsari','sukasari','pamulihan'))),
 CONSTRAINT ukhuwah_location_coordinates CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -7.5 AND -6.3 AND longitude BETWEEN 106.9 AND 108.3)),
 CONSTRAINT ukhuwah_location_consent CHECK (NOT (official_contact_shared OR pic_contact_shared) OR (contact_consent_confirmed AND length(trim(contact_consent_source)) > 0 AND contact_confirmed_at IS NOT NULL)),
 CONSTRAINT ukhuwah_location_contact CHECK ((NOT official_contact_shared OR length(official_phone) > 0) AND (NOT pic_contact_shared OR (length(pic_name) > 0 AND length(pic_phone) > 0)))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS ukhuwah_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author_user_id uuid NOT NULL REFERENCES users(id), title text NOT NULL, body text NOT NULL DEFAULT '',
 category text NOT NULL CHECK (category IN ('MAPPING','TEACHER','QURAN','YOUTH_FAMILY','FACILITIES','ACCESS','COLLABORATION','PROGRESS','SENSITIVE','OTHER')),
 city_code text NOT NULL, district text NOT NULL, location_id uuid REFERENCES ukhuwah_locations(id) ON DELETE SET NULL,
 observed_at date NOT NULL, source text NOT NULL DEFAULT '', urgency text NOT NULL DEFAULT 'NORMAL' CHECK (urgency IN ('NORMAL','HIGH')),
 audience text NOT NULL DEFAULT 'SHARED' CHECK (audience IN ('SHARED','ADMIN_ONLY')), hide_author boolean NOT NULL DEFAULT false,
 publication_status text NOT NULL DEFAULT 'DRAFT' CHECK (publication_status IN ('DRAFT','PENDING','APPROVED','REJECTED','HIDDEN')),
 work_status text NOT NULL DEFAULT 'OPEN' CHECK (work_status IN ('OPEN','IN_PROGRESS','RESOLVED','ARCHIVED')),
 moderation_reason text, moderated_by uuid REFERENCES users(id), followup_summary text NOT NULL DEFAULT '', coordinator_name text NOT NULL DEFAULT '', due_date date,
 version integer NOT NULL DEFAULT 1 CHECK (version > 0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT ukhuwah_report_region CHECK (city_code IN ('3273','3277','3204','3217','3211') AND (city_code <> '3211' OR lower(district) IN ('jatinangor','cimanggung','tanjungsari','sukasari','pamulihan'))),
 CONSTRAINT ukhuwah_report_sensitive CHECK (category <> 'SENSITIVE' OR audience = 'ADMIN_ONLY'),
 CONSTRAINT ukhuwah_report_moderation CHECK (publication_status <> 'APPROVED' OR (moderated_by IS NOT NULL AND moderated_by <> author_user_id AND length(trim(moderation_reason)) >= 3)),
 CONSTRAINT ukhuwah_report_content CHECK (length(trim(title)) BETWEEN 3 AND 200 AND length(body) <= 20000 AND length(source) <= 1000)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_ukhuwah_locations_scope ON ukhuwah_locations(is_published, city_code, updated_at, id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_ukhuwah_reports_author ON ukhuwah_reports(author_user_id, updated_at, id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_ukhuwah_reports_board ON ukhuwah_reports(audience, publication_status, city_code, updated_at, id);