-- Kiosk credentials are event-scoped, stored only as hashes, and revocable.
CREATE TABLE IF NOT EXISTS event_kiosk_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  label text NOT NULL,
  pairing_token_hash text NOT NULL UNIQUE,
  pairing_expires_at timestamptz NOT NULL,
  device_token_hash text UNIQUE,
  device_expires_at timestamptz,
  paired_at timestamptz,
  revoked_at timestamptz,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_event_kiosk_devices_event ON event_kiosk_devices(event_id);
