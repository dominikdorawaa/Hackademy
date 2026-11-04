-- Rooms lose their own publication: a room is visible exactly when a published path holds it.
-- Draft rooms inside a published path were hidden from players. They leave that path, so players see the same rooms
-- as before and the path editor keeps them in the room pool. Rooms, tasks, solves and points stay untouched.

UPDATE paths p
SET chapters_revision = p.chapters_revision + 1,
    content_revision = p.content_revision + 1
WHERE p.published
  AND EXISTS (
      SELECT 1 FROM chapter_rooms cr
      JOIN path_chapters pc ON pc.id = cr.chapter_id
      JOIN rooms r ON r.id = cr.room_id
      WHERE pc.path_id = p.id AND NOT r.published
  );

DELETE FROM chapter_rooms cr
USING path_chapters pc, paths p, rooms r
WHERE pc.id = cr.chapter_id
  AND p.id = pc.path_id
  AND r.id = cr.room_id
  AND p.published
  AND NOT r.published;

DROP INDEX IF EXISTS idx_rooms_published_type;
ALTER TABLE rooms DROP COLUMN published;
