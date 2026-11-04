-- A room may now belong to many paths, but to only one chapter of a given path.
ALTER TABLE chapter_rooms ADD COLUMN path_id bigint;
UPDATE chapter_rooms cr SET path_id = pc.path_id FROM path_chapters pc WHERE pc.id = cr.chapter_id;
ALTER TABLE chapter_rooms ALTER COLUMN path_id SET NOT NULL;

ALTER TABLE chapter_rooms DROP CONSTRAINT pk_chapter_rooms;
ALTER TABLE chapter_rooms ADD CONSTRAINT pk_chapter_rooms PRIMARY KEY (chapter_id, room_id);
ALTER TABLE chapter_rooms ADD CONSTRAINT uq_chapter_rooms_path_room UNIQUE (path_id, room_id);
CREATE INDEX idx_chapter_rooms_room ON chapter_rooms (room_id);

ALTER TABLE path_chapters ADD CONSTRAINT uq_path_chapters_id_path UNIQUE (id, path_id);
ALTER TABLE chapter_rooms ADD CONSTRAINT fk_chapter_rooms_chapter_path
    FOREIGN KEY (chapter_id, path_id) REFERENCES path_chapters (id, path_id) ON DELETE CASCADE;

CREATE FUNCTION chapter_rooms_copy_path_id() RETURNS trigger AS $$
BEGIN
    SELECT path_id INTO NEW.path_id FROM path_chapters WHERE id = NEW.chapter_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chapter_rooms_path_id
BEFORE INSERT OR UPDATE OF chapter_id ON chapter_rooms
FOR EACH ROW EXECUTE FUNCTION chapter_rooms_copy_path_id();
