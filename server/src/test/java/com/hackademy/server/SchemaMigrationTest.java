package com.hackademy.server;

import com.hackademy.server.clerk.ClerkUserResolver;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Testcontainers
class SchemaMigrationTest {
    static final int SCHEMA_VERSION = 25;
    @Container
    private static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17.11-alpine");

    private String schema;
    private String url;
    private String username;
    private String password;

    @BeforeEach
    void createSchema() throws Exception {
        schema = "schema_test_" + UUID.randomUUID().toString().replace("-", "");
        username = postgres.getUsername();
        password = postgres.getPassword();
        var baseUrl = postgres.getJdbcUrl();
        try (var connection = connect(baseUrl);
             var statement = connection.createStatement()) {
            statement.execute("CREATE SCHEMA " + schema);
        }
        url = baseUrl + (baseUrl.contains("?") ? "&" : "?") + "currentSchema=" + schema;
    }

    @AfterEach
    void dropSchema() throws Exception {
        if (schema == null) {
            return;
        }
        try (var connection = connect(postgres.getJdbcUrl());
             var statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA " + schema + " CASCADE");
        }
    }

    @Test
    void migratesEmptyDatabaseWithBadgesOnly() throws Exception {
        var flyway = flyway();
        assertEquals(SCHEMA_VERSION, flyway.migrate().migrationsExecuted);
        assertEquals(7, scalar("SELECT count(*) FROM badges"));
        assertEquals(0, scalar("SELECT count(*) FROM users"));
        assertEquals(0, scalar("SELECT count(*) FROM rooms"));
        assertEquals("ukos", text("SELECT system_key FROM paths"));
        assertEquals(0, flyway.migrate().migrationsExecuted);
        assertTrue(flyway.validateWithResult().validationSuccessful);
    }

    @Test
    void addsClerkIdentityAfterNotificationMigrationsWithoutChangingExistingAccounts() throws Exception {
        flyway("20").migrate();
        insertUser(1, "Alice", "alice@example.com");
        execute("INSERT INTO user_notification_preferences (user_id, sound, friend_online, friend_online_bell) VALUES (1, false, false, false)");

        assertEquals(SCHEMA_VERSION - 20, flyway().migrate().migrationsExecuted);
        assertEquals(String.valueOf(SCHEMA_VERSION), text("SELECT version FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 1"));
        assertEquals("clerk identity", text("SELECT description FROM flyway_schema_history WHERE version = '21'"));
        assertEquals(1, scalar("SELECT count(*) FROM users WHERE id = 1 AND username = 'Alice' AND email = 'alice@example.com' AND password = 'p' AND clerk_user_id IS NULL"));
        assertEquals(1, scalar("SELECT count(*) FROM user_notification_preferences WHERE user_id = 1 AND NOT sound AND NOT friend_online AND NOT friend_online_bell"));
        execute("UPDATE users SET clerk_user_id = 'user_alice', password = NULL WHERE id = 1");
        assertEquals(0, flyway().migrate().migrationsExecuted);
        assertTrue(flyway().validateWithResult().validationSuccessful);
    }

    @Test
    void deletionBlocksSurviveUserRemovalAndIdentityCannotBeReassigned() throws Exception {
        flyway("21").migrate();
        insertUser(1, "Alice", "alice@example.com");
        assertEquals(SCHEMA_VERSION - 21, flyway().migrate().migrationsExecuted);
        execute("INSERT INTO account_deletions (user_id, clerk_user_id) VALUES (1, 'user_alice')");
        execute("DELETE FROM users WHERE id = 1");
        assertEquals("user_alice", text("SELECT clerk_user_id FROM account_deletions WHERE user_id = 1"));
        assertSqlState("23505", "INSERT INTO account_deletions (user_id, clerk_user_id) VALUES (2, 'user_alice')");
        assertEquals(0, flyway().migrate().migrationsExecuted);
    }

    @Test
    void preservesExistingProfileWhenAddingPersonalization() throws Exception {
        Flyway.configure().dataSource(url, username, password)
                .locations("classpath:db/schema").target("5").load().migrate();
        execute("INSERT INTO users (id, username, email, password, role, points, streak, bio, created_at, updated_at) VALUES (1, 'Alice', 'alice@example.com', 'p', 'USER', 0, 0, 'Learning Linux', now(), now())");
        assertEquals(11, flyway("16").migrate().migrationsExecuted);
        assertEquals("Alice", text("SELECT avatar_seed FROM users WHERE id = 1"));
        assertEquals(SCHEMA_VERSION - 16, flyway().migrate().migrationsExecuted);
        assertEquals(0, scalar("SELECT count(*) FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'avatar_seed'"));
        assertEquals("COMPLETED", text("SELECT tour_status FROM users WHERE id = 1"));
        assertEquals(1, scalar("SELECT count(*) FROM users WHERE id = 1 AND avatar_confirmed_at IS NOT NULL"));
        assertEquals("Learning Linux", text("SELECT bio FROM users WHERE id = 1"));
        assertEquals("", text("SELECT tagline FROM users WHERE id = 1"));
        assertEquals(0, scalar("SELECT count(*) FROM user_profile_interests"));
        assertEquals(0, scalar("SELECT count(*) FROM user_featured_badges"));
        assertEquals(0, flyway().migrate().migrationsExecuted);
    }

    @Test
    void keepsExistingAvatarsAndGivesThemTheFrontPortraitPose() throws Exception {
        flyway("13").migrate();
        insertUser(1, "Alice", "alice@example.com");
        execute("INSERT INTO user_avatars (user_id, outfit, hair, hat, skin, hair_color, top_color, bottom_color, shoes_color, hat_color) VALUES (1, 'dres', 'kucyk', 'brak', 'heban', 'rude', 'bialy', 'granatowy', 'czerwony', 'bialy')");
        assertEquals(SCHEMA_VERSION - 13, flyway().migrate().migrationsExecuted);
        assertEquals("przod", text("SELECT pose FROM user_avatars WHERE user_id = 1"));
        assertEquals("kucyk", text("SELECT hair FROM user_avatars WHERE user_id = 1"));
        execute("UPDATE user_avatars SET pose = 'profil' WHERE user_id = 1");
        assertSqlState("23514", "UPDATE user_avatars SET pose = 'bokiem' WHERE user_id = 1");
        assertEquals("profil", text("SELECT pose FROM user_avatars WHERE user_id = 1"));
    }

    @Test
    void publishesExistingContentWithoutChangingPlayerProgress() throws Exception {
        Flyway.configure().dataSource(url, username, password).locations("classpath:db/schema").target("7").load().migrate();
        insertUser(1, "Alice", "alice@example.com");
        insertRoom(1);
        execute("INSERT INTO paths (id, title, created_at, updated_at) VALUES (1, 'Existing', now(), now())");
        execute("INSERT INTO user_solved_rooms (user_id, room_id, solved_at) VALUES (1, 1, now())");
        assertEquals(1, flyway("8").migrate().migrationsExecuted);
        assertEquals(1, scalar("SELECT count(*) FROM paths WHERE published"));
        assertEquals(1, scalar("SELECT count(*) FROM rooms WHERE published"));
        assertEquals(1, scalar("SELECT count(*) FROM user_solved_rooms WHERE user_id = 1 AND room_id = 1"));
    }

    @Test
    void scopesRoomTitlesAndDerivesCtfPointsFromDifficulty() throws Exception {
        flyway("8").migrate();
        execute("""
                INSERT INTO rooms (id, title, description, difficulty, category, points, flag, solutions_count, requires_vpn, room_type, created_at, updated_at) VALUES
                (1, 'Easy CTF', 'd', 'EASY', 'Web', 10, 'f', 0, false, 'CTF', now(), now()),
                (2, 'Hard CTF', 'd', 'HARD', 'Web', 999, 'f', 0, false, 'CTF', now(), now()),
                (3, 'Intro', 'd', 'MEDIUM', 'Path', 7, 'f', 0, false, 'PATH', now(), now()),
                (4, 'Other', 'd', 'EASY', 'Path', 5, 'f', 0, false, 'PATH', now(), now()),
                (7, ' Easy CTF ', 'd', 'EASY', 'Web', 50, 'f', 0, false, 'CTF', now(), now()),
                (8, '  Solo', 'd', 'EASY', 'Web', 50, 'f', 0, false, 'CTF', now(), now()),
                (9, 'Intro ', 'd', 'EASY', 'Path', 5, 'f', 0, false, 'PATH', now(), now()),
                (10, ' Loose', 'd', 'EASY', 'Path', 5, 'f', 0, false, 'PATH', now(), now()),
                (11, 'Loose', 'd', 'EASY', 'Path', 5, 'f', 0, false, 'PATH', now(), now()),
                (12, E'Tab\t', 'd', 'EASY', 'Path', 5, 'f', 0, false, 'PATH', now(), now());
                INSERT INTO users (id, username, email, password, role, points, streak, created_at, updated_at, avatar_seed) VALUES (1, 'Alice', 'alice@example.com', 'p', 'USER', 10, 0, now(), now(), 'seed');
                INSERT INTO user_solved_rooms (user_id, room_id, solved_at) VALUES (1, 1, now());
                INSERT INTO paths (id, title, created_at, updated_at) VALUES (1, 'Path', now(), now());
                INSERT INTO path_chapters (id, path_id, title, sort_order, created_at, updated_at) VALUES (1, 1, 'One', 0, now(), now()), (2, 1, 'Two', 1, now(), now());
                INSERT INTO chapter_rooms (room_id, chapter_id, sort_order) VALUES (3, 1, 0), (4, 1, 1), (9, 1, 2);
                """);

        assertEquals(SCHEMA_VERSION - 8, flyway().migrate().migrationsExecuted);

        assertEquals("1:50,2:150,3:7,4:5", text("SELECT string_agg(id || ':' || points, ',' ORDER BY id) FROM rooms WHERE id <= 4"));
        assertEquals(10, scalar("SELECT points FROM users WHERE id = 1"));
        assertEquals("1:Easy CTF|7:Easy CTF (7)|8:Solo|9:Intro (9)|10:Loose|11:Loose|12:Tab", text("SELECT string_agg(id || ':' || title, '|' ORDER BY id) FROM rooms WHERE id IN (1, 7, 8, 9, 10, 11, 12)"));
        assertEquals("Intro,Other,Intro (9)", text("SELECT string_agg(room_title, ',' ORDER BY sort_order) FROM chapter_rooms"));
        assertSqlState("23514", "UPDATE rooms SET title = ' Padded' WHERE id = 8");
        assertSqlState("23514", "UPDATE rooms SET title = E'Padded\\n' WHERE id = 8");
        assertSqlState("23514", "UPDATE rooms SET points = 60 WHERE id = 1");
        assertSqlState("23514", "UPDATE rooms SET difficulty = 'INSANE' WHERE id = 1");
        execute("UPDATE rooms SET difficulty = 'INSANE', points = 200 WHERE id = 1");
        assertSqlState("23505", "INSERT INTO rooms (id, title, description, difficulty, category, points, flag, solutions_count, requires_vpn, room_type, created_at, updated_at) VALUES (5, 'Hard CTF', 'd', 'HARD', 'Web', 150, 'f', 0, false, 'CTF', now(), now())");
        execute("INSERT INTO rooms (id, title, description, difficulty, category, points, flag, solutions_count, requires_vpn, room_type, created_at, updated_at) VALUES (5, 'Hard CTF', 'd', 'HARD', 'Path', 1, 'f', 0, false, 'PATH', now(), now())");
        execute("INSERT INTO rooms (id, title, description, difficulty, category, points, flag, solutions_count, requires_vpn, room_type, created_at, updated_at) VALUES (6, 'Intro', 'd', 'EASY', 'Path', 1, 'f', 0, false, 'PATH', now(), now())");
        assertSqlState("23505", "INSERT INTO chapter_rooms (room_id, chapter_id, sort_order) VALUES (6, 1, 2)");
        execute("INSERT INTO chapter_rooms (room_id, chapter_id, sort_order) VALUES (6, 2, 0)");
        assertSqlState("23505", "UPDATE rooms SET title = 'Intro' WHERE id = 4");
        execute("UPDATE rooms SET title = 'Renamed' WHERE id = 4");
        assertEquals("Renamed", text("SELECT room_title FROM chapter_rooms WHERE room_id = 4"));
        execute("UPDATE chapter_rooms SET room_title = 'Forged', chapter_id = 2 WHERE room_id = 4");
        assertEquals("Renamed", text("SELECT room_title FROM chapter_rooms WHERE room_id = 4"));
        assertSqlState("23505", "UPDATE chapter_rooms SET chapter_id = 2 WHERE room_id = 3");
    }

    @Test
    void setsExistingPathsToOpenUnlockMode() throws Exception {
        flyway("9").migrate();
        execute("INSERT INTO paths (id, title, created_at, updated_at) VALUES (1, 'Existing', now(), now())");
        assertEquals(1, flyway("10").migrate().migrationsExecuted);
        assertEquals("OPEN", text("SELECT unlock_mode FROM paths WHERE id = 1"));
        execute("UPDATE paths SET unlock_mode = 'ROOM' WHERE id = 1");
        assertSqlState("23514", "UPDATE paths SET unlock_mode = 'SEQUENTIAL' WHERE id = 1");
        assertSqlState("23502", "UPDATE paths SET unlock_mode = NULL WHERE id = 1");
    }

    @Test
    void startsApplicationTwiceAndProvisionsClerkUser() throws Exception {
        try (var context = startApplication()) {
            var resolver = context.getBean(ClerkUserResolver.class);
            var first = resolver.resolve(clerkJwt("user_schema_a", " Tester@Example.com "));
            assertEquals("tester@example.com", text("SELECT email FROM users WHERE clerk_user_id = 'user_schema_a'"));
            assertEquals(500, scalar("SELECT elo FROM users WHERE clerk_user_id = 'user_schema_a'"));
            assertEquals(first.getId(), resolver.resolve(clerkJwt("user_schema_a", "tester@example.com")).getId());
            assertThrows(BadCredentialsException.class, () -> resolver.resolve(clerkJwt("user_schema_b", "TESTER@example.com")));
            assertEquals(1, scalar("SELECT count(*) FROM users"));
            assertEquals(1, scalar("SELECT count(*) FROM users WHERE password IS NULL"));
        }
        try (var ignored = startApplication()) {
            assertEquals(SCHEMA_VERSION, scalar("SELECT count(*) FROM flyway_schema_history WHERE success"));
        }
    }

    private static Jwt clerkJwt(String subject, String email) {
        return Jwt.withTokenValue("token").header("alg", "RS256").subject(subject)
                .claim("email", email.trim()).claim("email_verified", true).build();
    }

    @Test
    void enforcesUniquenessAndChecks() throws Exception {
        flyway().migrate();
        insertUser(1, "Alice", "alice@example.com");
        insertUser(2, "Bob", "bob@example.com");
        assertSqlState("23505", "INSERT INTO users (id, username, email, password, role, points, streak, created_at, updated_at) VALUES (3, 'ALICE', 'x@example.com', 'p', 'USER', 0, 0, now(), now())");
        assertSqlState("23505", "INSERT INTO users (id, username, email, password, role, points, streak, created_at, updated_at) VALUES (3, 'Carol', 'alice@example.com', 'p', 'USER', 0, 0, now(), now())");
        assertSqlState("23514", "INSERT INTO users (id, username, email, password, role, points, streak, created_at, updated_at) VALUES (3, 'Carol', 'Carol@example.com', 'p', 'USER', 0, 0, now(), now())");
        assertSqlState("23514", "INSERT INTO users (id, username, email, password, role, points, streak, created_at, updated_at) VALUES (3, 'Carol', 'carol@example.com', 'p', 'GUEST', 0, 0, now(), now())");
        execute("INSERT INTO users (id, username, email, role, points, streak, created_at, updated_at, clerk_user_id) VALUES (3, 'Carol', 'carol@example.com', 'USER', 0, 0, now(), now(), 'user_carol')");
        assertSqlState("23505", "INSERT INTO users (id, username, email, role, points, streak, created_at, updated_at, clerk_user_id) VALUES (4, 'Dave', 'dave@example.com', 'USER', 0, 0, now(), now(), 'user_carol')");
        execute("INSERT INTO friendships (requester_id, receiver_id, status, requester_wins, receiver_wins, created_at) VALUES (1, 2, 'PENDING', 0, 0, now())");
        assertSqlState("23505", "INSERT INTO friendships (requester_id, receiver_id, status, requester_wins, receiver_wins, created_at) VALUES (2, 1, 'PENDING', 0, 0, now())");
        assertSqlState("23514", "INSERT INTO friendships (requester_id, receiver_id, status, requester_wins, receiver_wins, created_at) VALUES (1, 1, 'PENDING', 0, 0, now())");
        insertRoom(1);
        execute("INSERT INTO room_tasks (id, room_id, title, content, sort_order) VALUES (1, 1, 't', 'c', 0)");
        execute("INSERT INTO user_completed_tasks (user_id, task_id, completed_at) VALUES (1, 1, now())");
        assertSqlState("23505", "INSERT INTO user_completed_tasks (user_id, task_id, completed_at) VALUES (1, 1, now())");
        execute("INSERT INTO user_solved_rooms (user_id, room_id, solved_at) VALUES (1, 1, now())");
        assertSqlState("23505", "INSERT INTO user_solved_rooms (user_id, room_id, solved_at) VALUES (1, 1, now())");
        assertSqlState("23503", "INSERT INTO user_weekly_active_time (user_id, week_key, seconds, updated_at) VALUES (99, '2026-W40', 0, now())");
    }

    @Test
    void cascadesUserAndRoomDeletion() throws Exception {
        flyway().migrate();
        insertUser(1, "Alice", "alice@example.com");
        insertUser(2, "Bob", "bob@example.com");
        insertRoom(1);
        execute("""
                INSERT INTO room_tasks (id, room_id, title, content, sort_order) VALUES (1, 1, 't', 'c', 0);
                INSERT INTO hints (id, room_id, description) VALUES (1, 1, 'h');
                INSERT INTO room_files (room_id, file_name, data) VALUES (1, 'f.txt', '\\x00'::bytea);
                INSERT INTO paths (id, title, created_at, updated_at) VALUES (100, 'p', now(), now());
                INSERT INTO path_chapters (id, path_id, title, sort_order, created_at, updated_at) VALUES (1, 100, 'c', 0, now(), now());
                INSERT INTO chapter_rooms (room_id, chapter_id, sort_order) VALUES (1, 1, 0);
                INSERT INTO path_enrollments (user_id, path_id, enrolled_at) VALUES (1, 100, now());
                INSERT INTO user_solved_rooms (user_id, room_id, solved_at) VALUES (1, 1, now()), (2, 1, now());
                INSERT INTO user_completed_tasks (user_id, task_id, completed_at) VALUES (1, 1, now()), (2, 1, now());
                INSERT INTO user_unlocked_hints (user_id, hint_id) VALUES (1, 1), (2, 1);
                INSERT INTO user_badges (user_id, badge_id, earned_at) SELECT 1, id, now() FROM badges LIMIT 1;
                INSERT INTO friendships (requester_id, receiver_id, status, requester_wins, receiver_wins, created_at) VALUES (1, 2, 'ACCEPTED', 0, 0, now());
                INSERT INTO chat_messages (game_id, sender_id, sender_username, content, reported, sent_at) VALUES ('g', 1, 'Alice', 'hi', false, now());
                INSERT INTO user_weekly_active_time (user_id, week_key, seconds, updated_at) VALUES (1, '2026-W40', 10, now());
                """);
        execute("DELETE FROM users WHERE id = 1");
        assertEquals(0, scalar("""
                SELECT (SELECT count(*) FROM user_solved_rooms WHERE user_id = 1)
                     + (SELECT count(*) FROM user_completed_tasks WHERE user_id = 1)
                     + (SELECT count(*) FROM user_unlocked_hints WHERE user_id = 1)
                     + (SELECT count(*) FROM user_badges)
                     + (SELECT count(*) FROM friendships)
                     + (SELECT count(*) FROM chat_messages)
                     + (SELECT count(*) FROM user_weekly_active_time)
                     + (SELECT count(*) FROM path_enrollments)
                """));
        execute("DELETE FROM rooms WHERE id = 1");
        assertEquals(0, scalar("""
                SELECT (SELECT count(*) FROM room_tasks)
                     + (SELECT count(*) FROM hints)
                     + (SELECT count(*) FROM room_files)
                     + (SELECT count(*) FROM chapter_rooms)
                     + (SELECT count(*) FROM user_solved_rooms)
                     + (SELECT count(*) FROM user_completed_tasks)
                     + (SELECT count(*) FROM user_unlocked_hints)
                """));
        assertEquals(1, scalar("SELECT count(*) FROM users"));
        assertEquals(7, scalar("SELECT count(*) FROM badges"));
        assertEquals(1, scalar("SELECT count(*) FROM path_chapters"));
        execute("DELETE FROM paths WHERE id = 100");
        assertEquals(0, scalar("SELECT count(*) FROM path_chapters"));
    }

    @Test
    void movesPathRoomsIntoFirstChapterOfTheLowestPath() throws Exception {
        assertEquals(2, flyway("2").migrate().migrationsExecuted);
        for (long id = 1; id <= 5; id++) {
            insertRoom(id);
        }
        execute("""
                UPDATE rooms SET room_type = 'PATH' WHERE id <= 4;
                INSERT INTO paths (id, title, created_at, updated_at) VALUES (1, 'a', now(), now()), (2, 'b', now(), now()), (3, 'c', now(), now());
                INSERT INTO path_rooms (path_id, room_id, sort_order) VALUES (1, 3, 5), (1, 1, 7), (1, 2, 9), (2, 1, 0), (2, 4, 3), (1, 5, 0);
                """);

        assertEquals(1, flyway("3").migrate().migrationsExecuted);
        assertEquals(1, scalar("SELECT count(*) FROM chapter_rooms WHERE room_id = 5"));
        assertEquals(SCHEMA_VERSION - 3, flyway().migrate().migrationsExecuted);
        assertEquals(0, scalar("SELECT sum(tasks_revision) FROM rooms"));
        assertEquals(0, scalar("SELECT count(*) FROM chapter_rooms WHERE room_id = 5"));
        assertEquals(1, scalar("SELECT count(*) FROM rooms WHERE id = 5 AND room_type = 'CTF'"));
        assertEquals(0, scalar("SELECT sum(chapters_revision) FROM paths"));

        assertEquals(3, scalar("SELECT count(*) FROM path_chapters WHERE title = 'Rozdział 1' AND sort_order = 0"));
        assertEquals(3, scalar("SELECT count(DISTINCT path_id) FROM path_chapters"));
        assertEquals("3:0,1:1,2:2", text("""
                SELECT string_agg(cr.room_id || ':' || cr.sort_order, ',' ORDER BY cr.sort_order)
                FROM chapter_rooms cr JOIN path_chapters pc ON pc.id = cr.chapter_id WHERE pc.path_id = 1
                """));
        assertEquals("4:0", text("""
                SELECT string_agg(cr.room_id || ':' || cr.sort_order, ',' ORDER BY cr.sort_order)
                FROM chapter_rooms cr JOIN path_chapters pc ON pc.id = cr.chapter_id WHERE pc.path_id = 2
                """));
        assertEquals(0, scalar("SELECT count(*) FROM chapter_rooms cr JOIN path_chapters pc ON pc.id = cr.chapter_id WHERE pc.path_id = 3"));
        assertEquals(0, scalar("SELECT count(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'path_rooms'"));
        assertSqlState("23505", "INSERT INTO chapter_rooms (room_id, chapter_id, sort_order) SELECT 3, id, 1 FROM path_chapters WHERE path_id = 2");
        assertSqlState("23514", "INSERT INTO path_chapters (path_id, title, sort_order, created_at, updated_at) VALUES (1, '  ', 1, now(), now())");
    }

    private ConfigurableApplicationContext startApplication() {
        return new SpringApplicationBuilder(ServerApplication.class).run(
                "--DB_URL=" + url,
                "--DB_USERNAME=" + username,
                "--DB_PASSWORD=" + password,
                "--server.port=0"
        );
    }

    private Flyway flyway() {
        return Flyway.configure().dataSource(url, username, password)
                .locations("classpath:db/schema")
                .load();
    }

    private Flyway flyway(String target) {
        return Flyway.configure().dataSource(url, username, password)
                .locations("classpath:db/schema")
                .target(target)
                .load();
    }

    private void insertUser(long id, String username, String email) throws SQLException {
        boolean seeded = scalar("SELECT count(*) FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'avatar_seed'") > 0;
        execute("INSERT INTO users (id, username, email, password, role, points, streak, created_at, updated_at" + (seeded ? ", avatar_seed" : "") + ") VALUES ("
                + id + ", '" + username + "', '" + email + "', 'p', 'USER', 0, 0, now(), now()" + (seeded ? ", 'test-seed'" : "") + ")");
    }

    private void insertRoom(long id) throws SQLException {
        execute("INSERT INTO rooms (id, title, description, difficulty, category, points, flag, solutions_count, requires_vpn, room_type, created_at, updated_at) VALUES ("
                + id + ", 'room " + id + "', 'd', 'EASY', 'Web', 50, 'flag', 0, false, 'CTF', now(), now())");
    }

    private void assertSqlState(String expected, String sql) {
        var error = assertThrows(SQLException.class, () -> execute(sql));
        assertEquals(expected, error.getSQLState());
    }

    private Connection connect(String jdbcUrl) throws SQLException {
        return DriverManager.getConnection(jdbcUrl, username, password);
    }

    private void execute(String sql) throws SQLException {
        try (var connection = connect(url); var statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private long scalar(String sql) throws SQLException {
        try (var connection = connect(url); var statement = connection.createStatement();
             var result = statement.executeQuery(sql)) {
            result.next();
            return result.getLong(1);
        }
    }

    private String text(String sql) throws SQLException {
        try (var connection = connect(url); var statement = connection.createStatement();
             var result = statement.executeQuery(sql)) {
            result.next();
            return result.getString(1);
        }
    }
}
