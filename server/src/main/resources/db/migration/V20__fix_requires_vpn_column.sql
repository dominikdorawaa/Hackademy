-- Ensure column exists (idempotent)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS requires_vpn BOOLEAN NOT NULL DEFAULT FALSE;
