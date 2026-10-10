ALTER TABLE paths ADD COLUMN chapters_revision BIGINT NOT NULL DEFAULT 0;

-- V3 may already be applied: detach legacy CTF rooms without changing its checksum.
DELETE FROM chapter_rooms cr USING rooms r
WHERE cr.room_id = r.id AND r.room_type <> 'PATH';

WITH ordered AS (
    SELECT room_id, (row_number() OVER (PARTITION BY chapter_id ORDER BY sort_order, room_id) - 1)::integer AS position
    FROM chapter_rooms
)
UPDATE chapter_rooms cr SET sort_order = ordered.position
FROM ordered WHERE cr.room_id = ordered.room_id;
