package com.hackademy.server;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@EnabledIfEnvironmentVariable(named = "LEGACY_MIGRATION_TEST_URL", matches = ".+")
class FlywayMigrationTest {
    private String database;
    private String url;

    @BeforeEach
    void createDatabase() throws Exception {
        database = "migration_test_" + UUID.randomUUID().toString().replace("-", "");
        try (var connection = connect(System.getenv("LEGACY_MIGRATION_TEST_URL"));
             var statement = connection.createStatement()) {
            statement.execute("CREATE DATABASE " + database);
        }
        url = System.getenv("LEGACY_MIGRATION_TEST_URL").replaceFirst("/[^/]+$", "/" + database);
    }

    @AfterEach
    void dropDatabase() throws Exception {
        try (var connection = connect(System.getenv("LEGACY_MIGRATION_TEST_URL"));
             var statement = connection.createStatement()) {
            statement.execute("DROP DATABASE " + database + " WITH (FORCE)");
        }
    }

    @Test
    void migratesFreshDatabaseAndRestarts() throws Exception {
        var flyway = flyway("latest");
        flyway.migrate();
        assertEquals(7, scalar("SELECT count(*) FROM badges"));
        assertEquals(0, flyway.migrate().migrationsExecuted);
        assertTrue(flyway.validateWithResult().validationSuccessful);
    }

    @Test
    void removesDuplicatesBeforeV29AndPreservesEarliestCompletion() throws Exception {
        flyway("28").migrate();
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
        flyway("29").migrate();
        assertEquals(4, scalar("SELECT count(*) FROM user_completed_tasks"));
        var flyway = flyway("latest");
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

    private Flyway flyway(String target) {
        return Flyway.configure().dataSource(url, "postgres", "migration_test")
                .locations("classpath:db/migration")
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
