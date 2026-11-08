-- Public event contact is optional; existing events remain unchanged.
ALTER TABLE events ADD COLUMN IF NOT EXISTS public_contact_whatsapp text;
