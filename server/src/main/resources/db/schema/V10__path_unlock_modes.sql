ALTER TABLE paths ADD COLUMN unlock_mode varchar(16) NOT NULL DEFAULT 'OPEN';
ALTER TABLE paths ADD CONSTRAINT ck_paths_unlock_mode CHECK (unlock_mode IN ('OPEN', 'CHAPTER', 'ROOM'));
