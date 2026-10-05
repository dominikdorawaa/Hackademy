package com.hackademy.server;

import com.hackademy.server.auth.AuthService;
import com.hackademy.server.auth.LoginRequest;
import com.hackademy.server.auth.RegisterRequest;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@EnabledIfEnvironmentVariable(named = "MIGRATION_TEST_URL", matches = ".+")
class SchemaMigrationTest {
    private String schema;
    private String url;
    private String username;
    private String password;

    @BeforeEach
    void createSchema() throws Exception {
        schema = "schema_test_" + UUID.randomUUID().toString().replace("-", "");
        username = System.getenv().getOrDefault("MIGRATION_TEST_USERNAME", "postgres");
        password = System.getenv().getOrDefault("MIGRATION_TEST_PASSWORD", "migration_test");
        try (var connection = connect(System.getenv("MIGRATION_TEST_URL"));
             var statement = connection.createStatement()) {
            statement.execute("CREATE SCHEMA " + schema);
        }
        var baseUrl = System.getenv("MIGRATION_TEST_URL");
        url = baseUrl + (baseUrl.contains("?") ? "&" : "?") + "currentSchema=" + schema;
    }

    @AfterEach
    void dropSchema() throws Exception {
        if (schema == null) {
            return;
        }
        try (var connection = connect(System.getenv("MIGRATION_TEST_URL"));
             var statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA " + schema + " CASCADE");
        }
    }

    @Test
    void migratesEmptyDatabaseWithBadgesOnly() throws Exception {
        var flyway = flyway();
        assertEquals(2, flyway.migrate().migrationsExecuted);
        assertEquals(7, scalar("SELECT count(*) FROM badges"));
        assertEquals(0, scalar("SELECT count(*) FROM users"));
        assertEquals(0, scalar("SELECT count(*) FROM rooms"));
        assertEquals(0, flyway.migrate().migrationsExecuted);
        assertTrue(flyway.validateWithResult().validationSuccessful);
    }

    @Test
    void startsApplicationTwiceAndRegistersUser() throws Exception {
        try (var context = startApplication()) {
            var authService = context.getBean(AuthService.class);
            authService.register(new RegisterRequest("Tester", " Tester@Example.com ", "password123"));
            assertEquals("tester@example.com", text("SELECT email FROM users WHERE username = 'Tester'"));
            assertEquals(500, scalar("SELECT elo FROM users WHERE username = 'Tester'"));
            assertNotNull(authService.login(new LoginRequest("TESTER@example.com", "password123")).token());
            authService.register(new RegisterRequest("tester", "other@example.com", "password123"));
            authService.register(new RegisterRequest("Other", "tester@EXAMPLE.com", "password123"));
            assertEquals(1, scalar("SELECT count(*) FROM users"));
        }
        try (var ignored = startApplication()) {
            assertEquals(2, scalar("SELECT count(*) FROM flyway_schema_history WHERE success"));
        }
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
                INSERT INTO paths (id, title, created_at, updated_at) VALUES (1, 'p', now(), now());
                INSERT INTO path_rooms (path_id, room_id, sort_order) VALUES (1, 1, 0);
                INSERT INTO path_enrollments (user_id, path_id, enrolled_at) VALUES (1, 1, now());
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
                     + (SELECT count(*) FROM path_rooms)
                     + (SELECT count(*) FROM user_solved_rooms)
                     + (SELECT count(*) FROM user_completed_tasks)
                     + (SELECT count(*) FROM user_unlocked_hints)
                """));
        assertEquals(1, scalar("SELECT count(*) FROM users"));
        assertEquals(7, scalar("SELECT count(*) FROM badges"));
    }

    private ConfigurableApplicationContext startApplication() {
        return new SpringApplicationBuilder(ServerApplication.class).run(
                "--DB_URL=" + url,
                "--DB_USERNAME=" + username,
                "--DB_PASSWORD=" + password,
                "--JWT_SECRET=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
                "--server.port=0"
        );
    }

    private Flyway flyway() {
        return Flyway.configure().dataSource(url, username, password)
                .locations("classpath:db/schema")
                .load();
    }

    private void insertUser(long id, String username, String email) throws SQLException {
        execute("INSERT INTO users (id, username, email, password, role, points, streak, created_at, updated_at) VALUES ("
                + id + ", '" + username + "', '" + email + "', 'p', 'USER', 0, 0, now(), now())");
    }

    private void insertRoom(long id) throws SQLException {
        execute("INSERT INTO rooms (id, title, description, difficulty, category, points, flag, solutions_count, requires_vpn, room_type, created_at, updated_at) VALUES ("
                + id + ", 'room " + id + "', 'd', 'EASY', 'Web', 10, 'flag', 0, false, 'CTF', now(), now())");
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
