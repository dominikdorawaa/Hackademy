package com.hackademy.server;

import com.hackademy.server.realtime.RealtimeStateService;
import com.hackademy.server.user.Role;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import tools.jackson.databind.ObjectMapper;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {"spring.jpa.properties.hibernate.generate_statistics=true", "logging.level.org.hibernate.stat=ERROR", "logging.level.org.hibernate.engine.internal.StatisticalLoggingSessionEventListener=ERROR"})
class RealtimeQueryBudgetTest extends PostgresIntegrationTest {
    @Autowired RealtimeStateService states;
    @Autowired EntityManagerFactory factory;

    @Test
    void measuresSnapshotCostWithDifferentFriendCounts() throws Exception {
        var measurements = new ArrayList<Map<String, Object>>();
        var statistics = factory.unwrap(SessionFactory.class).getStatistics();
        for (int count : new int[]{5, 30}) {
            var owner = account(Role.USER);
            for (int i = 0; i < count; i++) {
                var friend = account(Role.USER);
                jdbcTemplate.update("INSERT INTO friendships(requester_id, receiver_id, status, requester_wins, receiver_wins, created_at) VALUES (?, ?, 'ACCEPTED', 2, 1, LOCALTIMESTAMP)", owner.id(), friend.id());
            }
            statistics.clear();
            long started = System.nanoTime();
            var state = states.forUser(owner.id());
            long elapsed = (System.nanoTime() - started) / 1_000_000;
            assertEquals(count, state.friends().size());
            var row = new LinkedHashMap<String, Object>();
            row.put("friends", count);
            row.put("sql", statistics.getPrepareStatementCount());
            row.put("millis", elapsed);
            measurements.add(row);
        }
        Files.writeString(Path.of("target/realtime-query-budget.json"), new ObjectMapper().writerWithDefaultPrettyPrinter().writeValueAsString(measurements));
        if (!Boolean.getBoolean("classroom.baseline")) {
            assertEquals(measurements.get(0).get("sql"), measurements.get(1).get("sql"));
            assertTrue(((Number) measurements.get(1).get("sql")).longValue() <= 5);
        }
    }

    @Test
    void explainsRequesterAndPairLookupsOnARealisticIndexSample() throws Exception {
        var owner = account(Role.USER);
        var receiver = account(Role.USER);
        jdbcTemplate.update("INSERT INTO friendships(requester_id, receiver_id, status, requester_wins, receiver_wins, created_at) VALUES (?, ?, 'ACCEPTED', 0, 0, LOCALTIMESTAMP)", owner.id(), receiver.id());
        String prefix = UUID.randomUUID().toString().substring(0, 8);
        jdbcTemplate.update("""
                WITH added AS (
                    INSERT INTO users(username, email, password, role, points, elo, streak, bio, created_at, updated_at)
                    SELECT ? || n, ? || n || '@example.invalid', 'p', 'USER', 0, 500, 0, '', LOCALTIMESTAMP, LOCALTIMESTAMP
                    FROM generate_series(1, 1000) n RETURNING id
                ) INSERT INTO friendships(requester_id, receiver_id, status, requester_wins, receiver_wins, created_at)
                  SELECT id, ?, 'ACCEPTED', 0, 0, LOCALTIMESTAMP FROM added
                """, prefix, prefix, receiver.id());
        jdbcTemplate.execute("ANALYZE friendships");
        String requester = String.join("\n", jdbcTemplate.queryForList("EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM friendships WHERE requester_id = ? AND status = 'ACCEPTED'", String.class, owner.id()));
        String pairQuery = Boolean.getBoolean("classroom.baseline")
                ? "EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM friendships WHERE (requester_id = ? AND receiver_id = ?) OR (requester_id = ? AND receiver_id = ?)"
                : "EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM friendships WHERE LEAST(requester_id, receiver_id) = LEAST(?, ?) AND GREATEST(requester_id, receiver_id) = GREATEST(?, ?)";
        String pair = String.join("\n", jdbcTemplate.queryForList(pairQuery, String.class, owner.id(), receiver.id(),
                Boolean.getBoolean("classroom.baseline") ? receiver.id() : owner.id(), Boolean.getBoolean("classroom.baseline") ? owner.id() : receiver.id()));
        Files.writeString(Path.of("target/friendship-query-plans.txt"), "Requester:\n" + requester + "\n\nPair:\n" + pair + "\n");
        if (!Boolean.getBoolean("classroom.baseline")) {
            assertTrue(requester.contains("idx_friendships_requester_status"));
            assertTrue(pair.contains("uq_friendships_pair"));
        }
        if (!Boolean.getBoolean("classroom.baseline")) assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM pg_indexes WHERE tablename = 'friendships' AND indexname = 'idx_friendships_requester_status'", Integer.class));
    }
}
