package com.hackademy.server.dashboard;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class DashboardMetrics {
    public record Counts(boolean vpn, int seconds, int badges, int friends) {}
    private final JdbcTemplate jdbc;

    public Counts read(Long userId) {
        return jdbc.queryForObject("""
                SELECT EXISTS(SELECT 1 FROM user_solved_rooms s JOIN rooms r ON r.id = s.room_id
                              WHERE s.user_id = ? AND r.title IN ('Tutorial VPN', 'Tutorial VM')),
                       COALESCE((SELECT seconds FROM user_weekly_active_time WHERE user_id = ? AND week_key = ?), 0),
                       (SELECT count(*) FROM user_badges WHERE user_id = ?),
                       (SELECT count(*) FROM friendships WHERE (requester_id = ? OR receiver_id = ?) AND status = 'ACCEPTED')
                """, (row, index) -> new Counts(row.getBoolean(1), row.getInt(2), row.getInt(3), row.getInt(4)),
                userId, userId, ActivityWeek.currentKey(), userId, userId, userId);
    }
}
