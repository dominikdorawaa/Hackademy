CREATE TEMPORARY TABLE hint_rooms_without_tasks ON COMMIT DROP AS
SELECT DISTINCT h.room_id
FROM hints h
WHERE NOT EXISTS (SELECT 1 FROM room_tasks t WHERE t.room_id = h.room_id);

INSERT INTO room_tasks (room_id, title, content, question, answer, sort_order)
SELECT room_id, 'Zadanie 1', '', NULL, md5(random()::text || clock_timestamp()::text), 0
FROM hint_rooms_without_tasks;

INSERT INTO user_completed_tasks (user_id, task_id, completed_at)
SELECT usr.user_id, t.id, usr.solved_at
FROM hint_rooms_without_tasks r
JOIN room_tasks t ON t.room_id = r.room_id
JOIN user_solved_rooms usr ON usr.room_id = r.room_id;

UPDATE rooms r
SET tasks_revision = r.tasks_revision + 1
FROM hint_rooms_without_tasks w
WHERE w.room_id = r.id;

ALTER TABLE hints ADD COLUMN task_id bigint;
ALTER TABLE hints ADD COLUMN sort_order integer;

UPDATE hints h
SET task_id = first_task.id,
    sort_order = ranked.position
FROM (SELECT id, row_number() OVER (PARTITION BY room_id ORDER BY id) - 1 AS position FROM hints) ranked,
     (SELECT DISTINCT ON (room_id) room_id, id FROM room_tasks ORDER BY room_id, sort_order, id) first_task
WHERE ranked.id = h.id
  AND first_task.room_id = h.room_id;

UPDATE rooms r
SET content_revision = r.content_revision + 1
WHERE EXISTS (SELECT 1 FROM hints h WHERE h.room_id = r.id);

ALTER TABLE hints ALTER COLUMN task_id SET NOT NULL;
ALTER TABLE hints ALTER COLUMN sort_order SET NOT NULL;
ALTER TABLE hints ADD CONSTRAINT fk_hints_task FOREIGN KEY (task_id) REFERENCES room_tasks (id) ON DELETE CASCADE;
DROP INDEX idx_hints_room;
ALTER TABLE hints DROP COLUMN room_id;
CREATE INDEX idx_hints_task_sort ON hints (task_id, sort_order);
