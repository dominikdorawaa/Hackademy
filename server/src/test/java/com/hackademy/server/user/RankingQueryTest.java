package com.hackademy.server.user;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
class RankingQueryTest {
    @Container
    private static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17.11-alpine");

    @BeforeEach
    void prepareUsers() throws Exception {
        try (var connection = connect(); var statement = connection.createStatement()) {
            statement.execute("DROP TABLE IF EXISTS users");
            statement.execute("CREATE TABLE users (id BIGINT PRIMARY KEY, username VARCHAR(40), points INTEGER, elo INTEGER)");
        }
    }

    private Connection connect() throws Exception {
        return DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }

    private void add(long id, String name, Integer points, Integer elo) throws Exception {
        try (var connection = connect(); var insert = connection.prepareStatement("INSERT INTO users VALUES (?, ?, ?, ?)")) {
            insert.setLong(1, id);
            insert.setString(2, name);
            insert.setObject(3, points);
            insert.setObject(4, elo);
            insert.executeUpdate();
        }
    }

    private List<List<Object>> ranking() throws Exception {
        String sql = UserRepository.class.getMethod("findRankingLeaders").getAnnotation(Query.class).value();
        var rows = new ArrayList<List<Object>>();
        try (var connection = connect(); var statement = connection.createStatement(); var result = statement.executeQuery(sql)) {
            while (result.next()) rows.add(List.of(result.getString("username"), result.getInt("points"), result.getInt("elo"), result.getInt("rankPoints"), result.getInt("rankElo")));
        }
        return rows;
    }

    @Test
    void includesArenaLeadersOutsideTheXpTopHundred() throws Exception {
        try (var connection = connect(); var insert = connection.prepareStatement("INSERT INTO users VALUES (?, ?, ?, ?)")) {
            for (int i = 1; i <= 120; i++) {
                insert.setLong(1, i);
                insert.setString(2, "player" + i);
                insert.setInt(3, 2000 - i);
                insert.setInt(4, 500);
                insert.addBatch();
            }
            insert.executeBatch();
        }
        add(121, "arenaLeader", 0, 1500);
        assertTrue(ranking().contains(List.of("arenaLeader", 0, 1500, 121, 1)));
        assertEquals(100, ranking().stream().filter(row -> (int) row.get(3) <= 100).count());
        assertTrue(ranking().size() <= 200);
    }

    @Test
    void preservesZeroEloSharedRanksAndDefaultValues() throws Exception {
        add(1, "alice", 200, 0);
        add(2, "bob", 200, 700);
        add(3, "carol", 100, null);
        add(4, "dave", null, 500);
        assertEquals(List.of(
                List.of("alice", 200, 0, 1, 4),
                List.of("bob", 200, 700, 1, 1),
                List.of("carol", 100, 500, 3, 2),
                List.of("dave", 0, 500, 4, 2)), ranking());
    }

    @Test
    void emptyUserTableHasNoSyntheticPlayers() throws Exception {
        assertTrue(ranking().isEmpty());
    }
}
