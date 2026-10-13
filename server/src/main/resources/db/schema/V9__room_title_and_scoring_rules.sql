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
