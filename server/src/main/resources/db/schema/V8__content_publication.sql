ALTER TABLE paths ADD COLUMN published boolean NOT NULL DEFAULT true;
ALTER TABLE paths ADD COLUMN content_revision bigint NOT NULL DEFAULT 0;
ALTER TABLE rooms ADD COLUMN published boolean NOT NULL DEFAULT true;
ALTER TABLE rooms ADD COLUMN content_revision bigint NOT NULL DEFAULT 0;
CREATE INDEX idx_paths_published ON paths (published);
CREATE INDEX idx_rooms_published_type ON rooms (published, room_type);
