package com.hackademy.server.admin;

import com.hackademy.server.dashboard.ActivityWeek;
import com.hackademy.server.room.RoomType;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AdminStatsService {

    static final Set<Integer> ALLOWED_RANGES = Set.of(7, 30, 90);
    static final int VISIBLE_PATH_SLICES = 3;
    static final int RECENT_SOLVES_LIMIT = 8;

    private final JdbcTemplate jdbcTemplate;

    private record SourceRow(RoomType roomType, Long pathId, String pathTitle, long count) {}

    @Transactional(readOnly = true)
    public AdminStatsDto getStats(int rangeDays) {
        if (!ALLOWED_RANGES.contains(rangeDays)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Zakres musi wynosić 7, 30 lub 90 dni");
        }
        LocalDate today = LocalDate.now();
        LocalDate start = today.minusDays(rangeDays - 1L);
        return new AdminStatsDto(totals(), rangeDays, timeline(start, today), solvesBySource(), recentSolves());
    }

    private AdminStatsDto.Totals totals() {
        return new AdminStatsDto.Totals(
                count("SELECT count(*) FROM users"),
                count("SELECT count(*) FROM user_solved_rooms"),
                count("SELECT count(DISTINCT user_id) FROM user_weekly_active_time WHERE week_key = ? AND seconds > 0", ActivityWeek.currentKey()),
                count("SELECT count(*) FROM chat_messages WHERE reported")
        );
    }

    private List<AdminStatsDto.Day> timeline(LocalDate start, LocalDate end) {
        LocalDateTime from = start.atStartOfDay();
        Map<LocalDate, Long> registrations = countByDay(
                "SELECT CAST(created_at AS date) AS day, count(*) AS total FROM users WHERE created_at >= ? GROUP BY 1", from);
        Map<LocalDate, Long> solves = countByDay(
                "SELECT CAST(solved_at AS date) AS day, count(*) AS total FROM user_solved_rooms WHERE solved_at >= ? GROUP BY 1", from);
        List<AdminStatsDto.Day> days = new ArrayList<>();
        for (LocalDate day = start; !day.isAfter(end); day = day.plusDays(1)) {
            days.add(new AdminStatsDto.Day(day, registrations.getOrDefault(day, 0L), solves.getOrDefault(day, 0L)));
        }
        return days;
    }

    private List<AdminStatsDto.Slice> solvesBySource() {
        List<SourceRow> rows = jdbcTemplate.query("""
                SELECT r.room_type AS room_type, p.id AS path_id, p.title AS path_title, count(*) AS total
                FROM user_solved_rooms usr
                JOIN rooms r ON r.id = usr.room_id
                LEFT JOIN chapter_rooms cr ON cr.room_id = r.id
                LEFT JOIN path_chapters pc ON pc.id = cr.chapter_id
                LEFT JOIN paths p ON p.id = pc.path_id
                GROUP BY r.room_type, p.id, p.title
                """, (rs, rowNum) -> new SourceRow(
                RoomType.valueOf(rs.getString("room_type")),
                rs.getObject("path_id", Long.class),
                rs.getString("path_title"),
                rs.getLong("total")));

        long ctf = 0;
        long unassigned = 0;
        List<SourceRow> paths = new ArrayList<>();
        for (SourceRow row : rows) {
            if (row.roomType() == RoomType.CTF) {
                ctf += row.count();
            } else if (row.pathId() == null) {
                unassigned += row.count();
            } else {
                paths.add(row);
            }
        }
        paths.sort(Comparator.comparingLong(SourceRow::count).reversed()
                .thenComparing(SourceRow::pathTitle, String.CASE_INSENSITIVE_ORDER)
                .thenComparing(SourceRow::pathId));

        List<AdminStatsDto.Slice> slices = new ArrayList<>();
        long otherPaths = 0;
        for (int i = 0; i < paths.size(); i++) {
            SourceRow row = paths.get(i);
            if (i < VISIBLE_PATH_SLICES) {
                slices.add(new AdminStatsDto.Slice("path-" + row.pathId(), row.pathTitle(), row.count()));
            } else {
                otherPaths += row.count();
            }
        }
        if (otherPaths > 0) slices.add(new AdminStatsDto.Slice("paths-other", "Pozostałe ścieżki", otherPaths));
        if (unassigned > 0) slices.add(new AdminStatsDto.Slice("paths-unassigned", "Pokoje poza ścieżkami", unassigned));
        if (ctf > 0) slices.add(new AdminStatsDto.Slice("ctf", "CTF", ctf));
        return slices;
    }

    private List<AdminStatsDto.RecentSolve> recentSolves() {
        return jdbcTemplate.query("""
                SELECT u.username, r.id AS room_id, r.title AS room_title, r.room_type, p.title AS path_title, usr.solved_at
                FROM user_solved_rooms usr
                JOIN users u ON u.id = usr.user_id
                JOIN rooms r ON r.id = usr.room_id
                LEFT JOIN chapter_rooms cr ON cr.room_id = r.id
                LEFT JOIN path_chapters pc ON pc.id = cr.chapter_id
                LEFT JOIN paths p ON p.id = pc.path_id
                ORDER BY usr.solved_at DESC, usr.id DESC
                LIMIT ?
                """, (rs, rowNum) -> new AdminStatsDto.RecentSolve(
                rs.getString("username"),
                rs.getLong("room_id"),
                rs.getString("room_title"),
                RoomType.valueOf(rs.getString("room_type")),
                rs.getString("path_title"),
                rs.getObject("solved_at", LocalDateTime.class)), RECENT_SOLVES_LIMIT);
    }

    private long count(String sql, Object... args) {
        Long value = jdbcTemplate.queryForObject(sql, Long.class, args);
        return value == null ? 0 : value;
    }

    private Map<LocalDate, Long> countByDay(String sql, LocalDateTime from) {
        Map<LocalDate, Long> counts = new HashMap<>();
        jdbcTemplate.query(sql, rs -> {
            counts.put(rs.getObject("day", LocalDate.class), rs.getLong("total"));
        }, from);
        return counts;
    }
}
