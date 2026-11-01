-- Standalone CTF rooms stop being a separate area: they move into ordinary open paths in place.
-- Room rows, ids, flags, hints, files, solves, awarded XP and user points stay untouched.
-- Only published rooms move, because a published path may not hold drafts; drafts stay in the room pool.

SELECT setval(pg_get_serial_sequence('paths', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM paths;
SELECT setval(pg_get_serial_sequence('path_chapters', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM path_chapters;

WITH tutorials AS (
    SELECT r.id, (row_number() OVER (ORDER BY r.title = 'Tutorial VPN', r.id) - 1)::integer AS position
    FROM rooms r
    WHERE r.title IN ('Tutorial VM', 'Tutorial VPN')
      AND r.published
      AND NOT EXISTS (SELECT 1 FROM chapter_rooms cr WHERE cr.room_id = r.id)
), path AS (
    INSERT INTO paths (title, description, published, unlock_mode, created_at, updated_at)
    SELECT 'Pierwsze kroki',
           'Przygotuj maszynę wirtualną i połączenie VPN. Ukończony samouczek VPN odblokowuje pokoje, które go wymagają.',
           true, 'OPEN', now(), now()
    WHERE EXISTS (SELECT 1 FROM tutorials)
    RETURNING id
), chapter AS (
    INSERT INTO path_chapters (path_id, title, sort_order, created_at, updated_at)
    SELECT id, 'Samouczki', 0, now(), now() FROM path
    RETURNING id, path_id
), enrollments AS (
    INSERT INTO path_enrollments (user_id, path_id, enrolled_at)
    SELECT DISTINCT usr.user_id, chapter.path_id, now()
    FROM user_solved_rooms usr
    JOIN tutorials t ON t.id = usr.room_id
    CROSS JOIN chapter
)
INSERT INTO chapter_rooms (room_id, chapter_id, sort_order)
SELECT t.id, chapter.id, t.position FROM tutorials t CROSS JOIN chapter;

WITH ctf AS (
    SELECT r.id, (row_number() OVER (ORDER BY r.created_at, r.id) - 1)::integer AS position
    FROM rooms r
    WHERE r.room_type = 'CTF'
      AND r.published
      AND NOT EXISTS (SELECT 1 FROM chapter_rooms cr WHERE cr.room_id = r.id)
), path AS (
    INSERT INTO paths (title, description, published, unlock_mode, created_at, updated_at)
    SELECT 'Zadania CTF',
           'Zadania z flagą do rozwiązania w dowolnej kolejności.',
           true, 'OPEN', now(), now()
    WHERE EXISTS (SELECT 1 FROM ctf)
    RETURNING id
), chapter AS (
    INSERT INTO path_chapters (path_id, title, sort_order, created_at, updated_at)
    SELECT id, 'Rozdział 1', 0, now(), now() FROM path
    RETURNING id, path_id
), enrollments AS (
    INSERT INTO path_enrollments (user_id, path_id, enrolled_at)
    SELECT DISTINCT usr.user_id, chapter.path_id, now()
    FROM user_solved_rooms usr
    JOIN ctf ON ctf.id = usr.room_id
    CROSS JOIN chapter
)
INSERT INTO chapter_rooms (room_id, chapter_id, sort_order)
SELECT ctf.id, chapter.id, ctf.position FROM ctf CROSS JOIN chapter;
