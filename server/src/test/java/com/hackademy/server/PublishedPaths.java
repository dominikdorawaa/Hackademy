package com.hackademy.server;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.SimpleJdbcInsert;

// Players see a room only through a published path, so tests put their rooms into one.
public final class PublishedPaths {
    private PublishedPaths() {}

    public static long publishInPath(DataSource dataSource, long... roomIds) {
        return publishInPath(new JdbcTemplate(dataSource), roomIds);
    }

    // SimpleJdbcInsert works on both PostgreSQL and the H2 database some tests use.
    public static long publishInPath(JdbcTemplate jdbc, long... roomIds) {
        var now = LocalDateTime.now();
        long path = new SimpleJdbcInsert(jdbc).withTableName("paths").usingColumns("title", "description", "published", "unlock_mode", "chapters_revision", "content_revision", "created_at", "updated_at")
                .usingGeneratedKeyColumns("id").executeAndReturnKey(Map.of("title", "Path " + UUID.randomUUID(), "description", "Ścieżka testowa",
                        "published", true, "unlock_mode", "OPEN", "chapters_revision", 0, "content_revision", 0, "created_at", now, "updated_at", now)).longValue();
        long chapter = new SimpleJdbcInsert(jdbc).withTableName("path_chapters").usingColumns("path_id", "title", "sort_order", "created_at", "updated_at")
                .usingGeneratedKeyColumns("id").executeAndReturnKey(Map.of("path_id", path, "title", "Rozdział", "sort_order", 0,
                        "created_at", now, "updated_at", now)).longValue();
        var assignments = new SimpleJdbcInsert(jdbc).withTableName("chapter_rooms");
        for (int i = 0; i < roomIds.length; i++) {
            // PostgreSQL fills path_id itself; the H2 schema has no such column, and SimpleJdbcInsert skips it there.
            assignments.execute(Map.of("room_id", roomIds[i], "chapter_id", chapter, "path_id", path, "sort_order", i));
        }
        return path;
    }
}
