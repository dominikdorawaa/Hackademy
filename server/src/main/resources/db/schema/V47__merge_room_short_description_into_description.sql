CREATE FUNCTION pg_temp.utf16_length(value text) RETURNS integer LANGUAGE sql IMMUTABLE AS $$
    SELECT char_length(value) + char_length(regexp_replace(value, '[^\U00010000-\U0010FFFF]', '', 'g'))
$$;

CREATE FUNCTION pg_temp.trim_space(value text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT regexp_replace(coalesce(value, ''), '^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$', '', 'g')
$$;

CREATE FUNCTION pg_temp.prefix_within(value text, units integer) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    result text := left(value, units);
BEGIN
    WHILE pg_temp.utf16_length(result) > units LOOP
        result := left(result, char_length(result) - 1);
    END LOOP;
    RETURN result;
END
$$;

CREATE FUNCTION pg_temp.description_head(value text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    window_text text;
    head text;
BEGIN
    IF pg_temp.utf16_length(value) <= 200 THEN
        RETURN value;
    END IF;
    window_text := pg_temp.prefix_within(value, 201);
    head := substring(window_text FROM '^(.*(?:[.!?](?=[ \t\n\r\f\v])|[^ \t\n\r\f\v](?=[ \t]*[\r\n])))');
    IF head IS NULL THEN
        head := substring(window_text FROM '^(.*[^ \t\n\r\f\v])(?=[ \t\n\r\f\v])');
    END IF;
    IF head IS NULL THEN
        head := pg_temp.prefix_within(value, 200);
    END IF;
    RETURN head;
END
$$;

CREATE FUNCTION pg_temp.paragraph(value text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT '<p>' || replace(replace(replace(replace(replace(replace(value, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
        E'\r\n', E'\n'), E'\r', E'\n'), E'\n', '<br>') || '</p>'
$$;

CREATE TEMPORARY TABLE room_description_merge ON COMMIT DROP AS
WITH source AS (
    SELECT r.id AS room_id,
           r.description AS old_description,
           pg_temp.trim_space(r.short_description) AS short_text,
           pg_temp.trim_space(r.description) AS full_text,
           EXISTS (SELECT 1 FROM room_tasks t WHERE t.room_id = r.id) AS has_tasks
    FROM rooms r
), chosen AS (
    SELECT s.*, CASE WHEN s.short_text <> '' THEN s.short_text ELSE s.full_text END AS lead_text
    FROM source s
), cut AS (
    SELECT l.*, pg_temp.description_head(l.lead_text) AS head
    FROM chosen l
), merged AS (
    SELECT c.room_id, c.old_description, c.has_tasks, c.head AS description,
           concat(
               CASE WHEN pg_temp.trim_space(substr(c.lead_text, char_length(c.head) + 1)) <> ''
                    THEN pg_temp.paragraph(pg_temp.trim_space(substr(c.lead_text, char_length(c.head) + 1))) END,
               CASE WHEN c.short_text <> '' AND c.full_text <> '' AND c.full_text <> c.short_text
                    THEN pg_temp.paragraph(c.full_text) END
           ) AS moved
    FROM cut c
)
SELECT room_id, has_tasks, description, moved
FROM merged
WHERE description <> old_description OR moved <> '';

UPDATE room_tasks t
SET content = m.moved || t.content
FROM room_description_merge m
WHERE m.moved <> ''
  AND m.has_tasks
  AND t.id = (SELECT f.id FROM room_tasks f WHERE f.room_id = m.room_id ORDER BY f.sort_order, f.id LIMIT 1);

INSERT INTO room_tasks (room_id, title, content, question, answer, sort_order)
SELECT m.room_id, 'Wstęp', m.moved, NULL, NULL, 0
FROM room_description_merge m
WHERE m.moved <> ''
  AND NOT m.has_tasks;

INSERT INTO user_completed_tasks (user_id, task_id, completed_at)
SELECT usr.user_id, t.id, usr.solved_at
FROM room_description_merge m
JOIN room_tasks t ON t.room_id = m.room_id
JOIN user_solved_rooms usr ON usr.room_id = m.room_id
WHERE m.moved <> ''
  AND NOT m.has_tasks;

UPDATE rooms r
SET description = m.description,
    content_revision = r.content_revision + 1,
    tasks_revision = r.tasks_revision + CASE WHEN m.moved <> '' THEN 1 ELSE 0 END
FROM room_description_merge m
WHERE m.room_id = r.id;

DROP FUNCTION pg_temp.paragraph(text);
DROP FUNCTION pg_temp.description_head(text);
DROP FUNCTION pg_temp.prefix_within(text, integer);
DROP FUNCTION pg_temp.trim_space(text);
DROP FUNCTION pg_temp.utf16_length(text);
