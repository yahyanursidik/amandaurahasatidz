-- Preserve existing event behavior. This policy only affects NEW regular registrations.
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "regular_allow_group" boolean NOT NULL DEFAULT true;
