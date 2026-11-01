-- Rooms are solved only through tasks. A room without tasks that still has a room flag gets one task:
-- its content is the room description (escaped, line breaks kept) and its answer is the flag.
-- Players who solved such a room keep the solve and get the new task marked as completed.

CREATE TEMPORARY TABLE flag_tasks ON COMMIT DROP AS
SELECT r.id AS room_id, r.flag, r.description
FROM rooms r
WHERE btrim(r.flag) <> ''
  AND NOT EXISTS (SELECT 1 FROM room_tasks t WHERE t.room_id = r.id);

INSERT INTO room_tasks (room_id, title, content, question, answer, sort_order)
SELECT ft.room_id,
       'Zdobądź flagę',
       '<p>' || replace(replace(replace(replace(replace(ft.description, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
           E'\r\n', E'\n'), E'\n', '<br>') || '</p>',
       NULL,
       ft.flag,
       0
FROM flag_tasks ft;

INSERT INTO user_completed_tasks (user_id, task_id, completed_at)
SELECT usr.user_id, t.id, usr.solved_at
FROM flag_tasks ft
JOIN room_tasks t ON t.room_id = ft.room_id
JOIN user_solved_rooms usr ON usr.room_id = ft.room_id;

UPDATE rooms r
SET tasks_revision = r.tasks_revision + 1,
    content_revision = r.content_revision + 1
FROM flag_tasks ft
WHERE ft.room_id = r.id;

ALTER TABLE rooms DROP COLUMN flag;

-- CTF rooms live in paths like theory rooms, so a title only has to be unique within its chapter.
DROP INDEX uq_rooms_ctf_title;
