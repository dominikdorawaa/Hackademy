ALTER TABLE users ADD COLUMN last_seen_at timestamp;
ALTER TABLE users ADD COLUMN share_activity boolean NOT NULL DEFAULT true;
