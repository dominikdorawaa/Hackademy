-- Rooms are solved only through tasks. A room without tasks that still has a room flag gets one task:
-- its content is the room description (escaped, line breaks kept) and its answer is the flag.
-- A theory room also gets a question, because a published theory task needs a question with its answer.
-- Players who solved such a room keep the solve and get the new task marked as completed.

CREATE TEMPORARY TABLE flag_tasks ON COMMIT DROP AS
SELECT r.id AS room_id, r.flag, r.room_type,
       '<p>' || replace(replace(replace(replace(replace(r.description, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
           E'\r\n', E'\n'), E'\n', '<br>') || '</p>' AS content
FROM rooms r
WHERE btrim(r.flag) <> ''
  AND NOT EXISTS (SELECT 1 FROM room_tasks t WHERE t.room_id = r.id);

-- Task content may hold at most 20000 characters. An escaped description that no longer fits stays only
-- in the room description, which the first task shows above its content.
INSERT INTO room_tasks (room_id, title, content, question, answer, sort_order)
SELECT ft.room_id,
       'Zdobądź flagę',
       CASE WHEN char_length(ft.content) <= 20000 THEN ft.content
            ELSE '<p>Treść zadania znajdziesz w opisie pokoju powyżej.</p>' END,
       CASE WHEN ft.room_type = 'PATH' THEN 'Jaka jest flaga?' END,
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
