package com.hackademy.server;

import com.hackademy.server.dashboard.DashboardMetrics;
import com.hackademy.server.user.Role;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DashboardAccessIntegrationTest extends PostgresIntegrationTest {
    @Autowired DashboardMetrics metrics;

    @Test
    void preservesExistingVmOrVpnTutorialAccessRule() throws Exception {
        var learner = account(Role.USER);
        assertFalse(metrics.read(learner.id()).vpn());
        long room = jdbcTemplate.queryForObject("INSERT INTO rooms(title, description, difficulty, category, points, flag, room_type, published, requires_vpn, solutions_count, created_at, updated_at) VALUES ('Tutorial VM', 'test', 'EASY', 'Tutorial', 50, 'flag', 'CTF', true, false, 0, LOCALTIMESTAMP, LOCALTIMESTAMP) RETURNING id", Long.class);
        jdbcTemplate.update("INSERT INTO user_solved_rooms(user_id, room_id, solved_at) VALUES (?, ?, LOCALTIMESTAMP)", learner.id(), room);
        assertTrue(metrics.read(learner.id()).vpn());
    }
}
