UPDATE rooms
SET points = CASE difficulty
    WHEN 'EASY' THEN 50
    WHEN 'MEDIUM' THEN 100
    WHEN 'HARD' THEN 150
    WHEN 'INSANE' THEN 200
END
WHERE room_type = 'CTF';

ALTER TABLE rooms ADD CONSTRAINT ck_rooms_ctf_points CHECK (
    room_type <> 'CTF' OR points = CASE difficulty
        WHEN 'EASY' THEN 50
        WHEN 'MEDIUM' THEN 100
        WHEN 'HARD' THEN 150
        WHEN 'INSANE' THEN 200
    END
);

ALTER TABLE rooms DROP CONSTRAINT uq_rooms_title;

UPDATE rooms r
SET title = normalized.title
FROM (
    SELECT id,
        CASE WHEN duplicate_rank > 1 THEN left(base, 230) || ' (' || id || ')' ELSE base END AS title
    FROM (
        SELECT trimmed.id, trimmed.base,
            row_number() OVER (
                PARTITION BY CASE
                    WHEN trimmed.room_type = 'CTF' THEN 'ctf'
                    WHEN cr.chapter_id IS NOT NULL THEN 'chapter:' || cr.chapter_id
                    ELSE 'room:' || trimmed.id
                END, trimmed.base
                ORDER BY (trimmed.original = trimmed.base) DESC, trimmed.id
            ) AS duplicate_rank
        FROM (
            SELECT id, room_type, title AS original,
                CASE WHEN regexp_replace(title, '^[\x01-\x20]+|[\x01-\x20]+$', '', 'g') = '' THEN 'Room ' || id
                    ELSE regexp_replace(title, '^[\x01-\x20]+|[\x01-\x20]+$', '', 'g') END AS base
            FROM rooms
        ) trimmed
        LEFT JOIN chapter_rooms cr ON cr.room_id = trimmed.id
    ) ranked
) normalized
WHERE normalized.id = r.id AND r.title <> normalized.title;

ALTER TABLE rooms ADD CONSTRAINT ck_rooms_title_trimmed CHECK (title <> '' AND title !~ '^[\x01-\x20]|[\x01-\x20]$');
CREATE UNIQUE INDEX uq_rooms_ctf_title ON rooms (title) WHERE room_type = 'CTF';

ALTER TABLE chapter_rooms ADD COLUMN room_title varchar(255);
UPDATE chapter_rooms cr SET room_title = r.title FROM rooms r WHERE r.id = cr.room_id;
ALTER TABLE chapter_rooms ALTER COLUMN room_title SET NOT NULL;
CREATE UNIQUE INDEX uq_chapter_rooms_title ON chapter_rooms (chapter_id, room_title);

CREATE FUNCTION chapter_rooms_copy_room_title() RETURNS trigger AS $$
BEGIN
    SELECT title INTO NEW.room_title FROM rooms WHERE id = NEW.room_id FOR SHARE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chapter_rooms_room_title
BEFORE INSERT OR UPDATE ON chapter_rooms
FOR EACH ROW EXECUTE FUNCTION chapter_rooms_copy_room_title();

CREATE FUNCTION rooms_sync_chapter_room_title() RETURNS trigger AS $$
BEGIN
    UPDATE chapter_rooms SET room_title = NEW.title WHERE room_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rooms_chapter_room_title
AFTER UPDATE OF title ON rooms
FOR EACH ROW WHEN (OLD.title IS DISTINCT FROM NEW.title)
EXECUTE FUNCTION rooms_sync_chapter_room_title();
