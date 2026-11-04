INSERT INTO path_enrollments (user_id, path_id, enrolled_at)
SELECT DISTINCT solved.user_id, chapter.path_id, now()
FROM user_solved_rooms solved
JOIN chapter_rooms room ON room.room_id = solved.room_id
JOIN path_chapters chapter ON chapter.id = room.chapter_id
JOIN paths path ON path.id = chapter.path_id AND path.published = true
WHERE NOT EXISTS (
    SELECT 1
    FROM path_enrollments joined
    JOIN paths joined_path ON joined_path.id = joined.path_id AND joined_path.published = true
    JOIN path_chapters joined_chapter ON joined_chapter.path_id = joined.path_id
    JOIN chapter_rooms joined_room ON joined_room.chapter_id = joined_chapter.id
    WHERE joined.user_id = solved.user_id AND joined_room.room_id = solved.room_id
)
ON CONFLICT DO NOTHING;
