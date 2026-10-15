package com.hackademy.server.admin;

import com.hackademy.server.dashboard.ActivityWeek;
import com.hackademy.server.room.RoomType;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class AdminStatsServiceTest {

    private final FakeJdbcTemplate jdbc = new FakeJdbcTemplate();
    private final AdminStatsService service = new AdminStatsService(jdbc);

    @Test
    void rejectsUnsupportedRanges() {
        for (int range : new int[] {0, 1, 15, 365}) {
            var error = assertThrows(ResponseStatusException.class, () -> service.getStats(range));
            assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        }
        assertTrue(jdbc.countSql.isEmpty());
    }

    @Test
    void emptyDatabaseGivesZerosAndNoSlices() {
        var stats = service.getStats(7);

        assertEquals(new AdminStatsDto.Totals(0, 0, 0, 0), stats.totals());
        assertEquals(7, stats.rangeDays());
        assertEquals(7, stats.timeline().size());
        LocalDate today = LocalDate.now();
        for (int i = 0; i < 7; i++) {
            assertEquals(new AdminStatsDto.Day(today.minusDays(6 - i), 0, 0), stats.timeline().get(i));
        }
        assertTrue(stats.solvesBySource().isEmpty());
        assertTrue(stats.recentSolves().isEmpty());
        assertEquals(List.of(ActivityWeek.currentKey()), jdbc.countArgs.get(2));
        assertEquals(List.of(AdminStatsService.RECENT_SOLVES_LIMIT), jdbc.recentArgs);
    }

    @Test
    void summarizesTotalsTimelineSourcesAndRecentSolves() {
        LocalDate today = LocalDate.now();
        jdbc.counts.addAll(List.of(4L, 20L, 2L, 1L));
        jdbc.registrations.add(row("day", today, "total", 2L));
        jdbc.solves.add(row("day", today.minusDays(1), "total", 3L));
        jdbc.sources.addAll(List.of(
                source("CTF", null, null, 3),
                source("CTF", 9L, "Ctf in path", 1),
                source("PATH", null, null, 1),
                source("PATH", 3L, "beta", 5),
                source("PATH", 2L, "Alpha", 5),
                source("PATH", 1L, "alpha", 5),
                source("PATH", 4L, "delta", 2),
                source("PATH", 5L, "epsilon", 1)));
        var solvedAt = LocalDateTime.of(2026, 10, 1, 12, 0);
        jdbc.recent.add(row("username", "alice", "room_id", 7L, "room_title", "Room",
                "room_type", "PATH", "path_title", "alpha", "solved_at", solvedAt));

        var stats = service.getStats(30);

        assertEquals(new AdminStatsDto.Totals(4, 20, 2, 1), stats.totals());
        assertEquals(30, stats.timeline().size());
        assertEquals(new AdminStatsDto.Day(today, 2, 0), stats.timeline().get(29));
        assertEquals(new AdminStatsDto.Day(today.minusDays(1), 0, 3), stats.timeline().get(28));
        assertEquals(today.minusDays(29), stats.timeline().get(0).date());
        assertEquals(List.of(
                new AdminStatsDto.Slice("path-1", "alpha", 5),
                new AdminStatsDto.Slice("path-2", "Alpha", 5),
                new AdminStatsDto.Slice("path-3", "beta", 5),
                new AdminStatsDto.Slice("paths-other", "Pozostałe ścieżki", 3),
                new AdminStatsDto.Slice("paths-unassigned", "Pokoje poza ścieżkami", 1),
                new AdminStatsDto.Slice("ctf", "CTF", 4)), stats.solvesBySource());
        assertEquals(List.of(new AdminStatsDto.RecentSolve("alice", 7L, "Room", RoomType.PATH, "alpha", solvedAt)),
                stats.recentSolves());
    }

    @Test
    void ninetyDayRangeIsAccepted() {
        assertEquals(90, service.getStats(90).timeline().size());
    }

    private static Map<String, Object> source(String type, Long pathId, String title, long count) {
        return row("room_type", type, "path_id", pathId, "path_title", title, "total", count);
    }

    private static Map<String, Object> row(Object... keyValues) {
        Map<String, Object> row = new HashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            row.put((String) keyValues[i], keyValues[i + 1]);
        }
        return row;
    }

    private static ResultSet resultSet(Map<String, Object> row) {
        return mock(ResultSet.class, invocation -> {
            Object value = row.get(invocation.<String>getArgument(0));
            return switch (invocation.getMethod().getName()) {
                case "getLong" -> value == null ? 0L : ((Number) value).longValue();
                case "getString" -> (String) value;
                case "getObject" -> value;
                default -> throw new UnsupportedOperationException(invocation.getMethod().getName());
            };
        });
    }

    /** Answers the four queries AdminStatsService makes with canned rows. */
    private static class FakeJdbcTemplate extends JdbcTemplate {
        final List<Long> counts = new ArrayList<>();
        final List<String> countSql = new ArrayList<>();
        final List<List<Object>> countArgs = new ArrayList<>();
        final List<Map<String, Object>> registrations = new ArrayList<>();
        final List<Map<String, Object>> solves = new ArrayList<>();
        final List<Map<String, Object>> sources = new ArrayList<>();
        final List<Map<String, Object>> recent = new ArrayList<>();
        List<Object> recentArgs;

        @Override
        @SuppressWarnings("unchecked")
        public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
            countSql.add(sql);
            countArgs.add(List.of(args));
            int index = countSql.size() - 1;
            return index < counts.size() ? (T) counts.get(index) : null;
        }

        @Override
        public void query(String sql, RowCallbackHandler handler, Object... args) {
            var rows = sql.contains("FROM users") ? registrations : solves;
            for (var row : rows) {
                try {
                    handler.processRow(resultSet(row));
                } catch (SQLException e) {
                    throw new IllegalStateException(e);
                }
            }
        }

        @Override
        public <T> List<T> query(String sql, RowMapper<T> mapper) {
            return map(sources, mapper);
        }

        @Override
        public <T> List<T> query(String sql, RowMapper<T> mapper, Object... args) {
            recentArgs = List.of(args);
            return map(recent, mapper);
        }

        private static <T> List<T> map(List<Map<String, Object>> rows, RowMapper<T> mapper) {
            List<T> out = new ArrayList<>();
            for (int i = 0; i < rows.size(); i++) {
                try {
                    out.add(mapper.mapRow(resultSet(rows.get(i)), i));
                } catch (SQLException e) {
                    throw new IllegalStateException(e);
                }
            }
            return out;
        }
    }
}
