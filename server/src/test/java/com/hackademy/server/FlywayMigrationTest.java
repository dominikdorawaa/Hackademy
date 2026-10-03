package com.hackademy.server;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.HexFormat;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@EnabledIfEnvironmentVariable(named = "MIGRATION_TEST_URL", matches = ".+")
class FlywayMigrationTest {
    private String database;
    private String url;

    @BeforeEach
    void createDatabase() throws Exception {
        database = "migration_test_" + UUID.randomUUID().toString().replace("-", "");
        try (var connection = connect(System.getenv("MIGRATION_TEST_URL"));
             var statement = connection.createStatement()) {
            statement.execute("CREATE DATABASE " + database);
        }
        url = System.getenv("MIGRATION_TEST_URL").replaceFirst("/[^/]+$", "/" + database);
    }

    @AfterEach
    void dropDatabase() throws Exception {
        try (var connection = connect(System.getenv("MIGRATION_TEST_URL"));
             var statement = connection.createStatement()) {
            statement.execute("DROP DATABASE " + database + " WITH (FORCE)");
        }
    }

    @Test
    void migratesFreshDatabaseAndRestarts() throws Exception {
        var flyway = flyway(false, "latest");
        flyway.migrate();
        assertEquals(7, scalar("SELECT count(*) FROM badges"));
        assertEquals(0, flyway.migrate().migrationsExecuted);
        assertTrue(flyway.validateWithResult().validationSuccessful);
    }

    @Test
    void preservesPreviouslyAppliedV29Checksum() throws Exception {
        try (var resource = getClass().getResourceAsStream("/db/migration/V29__restore_schema_invariants.sql")) {
            var sql = new String(resource.readAllBytes(), StandardCharsets.UTF_8)
                    .replace("\r\n", "\n").stripTrailing();
            assertEquals("172f70e95d0d2747a87c8ef361fd4ba518d8654b480486896643b08bd67b5b96",
                    HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                            .digest(sql.getBytes(StandardCharsets.UTF_8))));
        }
        flyway(true, "29").migrate();
        var flyway = flyway(false, "latest");
        assertTrue(flyway.validateWithResult().validationSuccessful);
        assertEquals(0, flyway.migrate().migrationsExecuted);
    }

    @Test
    void removesDuplicatesBeforeV29AndPreservesEarliestCompletion() throws Exception {
        flyway(true, "28").migrate();
        execute("""
                INSERT INTO users (id, created_at, email, password, points, role, streak, updated_at, username)
                VALUES (1, now(), 'test@example.com', 'unused', 0, 'USER', 0, now(), 'tester');
                INSERT INTO rooms (id, category, created_at, description, difficulty, flag, points,
                    requires_vpn, room_type, solutions_count, title, updated_at)
                VALUES (1, 'test', now(), 'test', 'EASY', 'flag', 10, false, 'CTF', 0, 'test', now());
                INSERT INTO room_tasks (id, content, sort_order, title, room_id)
                VALUES (1, 'test', 0, 'test', 1), (2, 'test', 1, 'test', 1);
                INSERT INTO user_completed_tasks (id, completed_at, task_id, user_id)
                VALUES (1, '2026-01-02', 1, 1), (2, '2026-01-01', 1, 1),
                    (3, '2026-01-01', 1, 1), (4, '2026-01-01', 2, 1);
                """);
        var flyway = flyway(false, "latest");
        flyway.migrate();
        assertEquals(2, scalar("SELECT count(*) FROM user_completed_tasks"));
        assertEquals(2, scalar("SELECT id FROM user_completed_tasks WHERE task_id = 1"));
        var error = assertThrows(SQLException.class, () -> execute("""
                INSERT INTO user_completed_tasks (id, completed_at, task_id, user_id)
                VALUES (5, now(), 1, 1)
                """));
        assertEquals("23505", error.getSQLState());
        assertEquals(0, flyway.migrate().migrationsExecuted);
        assertEquals(2, scalar("SELECT count(*) FROM user_completed_tasks"));
    }

    private Flyway flyway(boolean skipCallbacks, String target) {
        return Flyway.configure().dataSource(url, "postgres", "migration_test")
                .locations("classpath:db/migration").skipDefaultCallbacks(skipCallbacks)
                .target(target).load();
    }

    private Connection connect(String jdbcUrl) throws SQLException {
        return DriverManager.getConnection(jdbcUrl, "postgres", "migration_test");
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
}
