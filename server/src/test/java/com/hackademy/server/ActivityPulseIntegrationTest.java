package com.hackademy.server;

import com.hackademy.server.user.Role;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ActivityPulseIntegrationTest extends PostgresIntegrationTest {
    @Test
    void usesServerElapsedTimeAndStopsCountingWhileHidden() throws Exception {
        var account = account(Role.USER);
        pulse(account, true, 0);
        jdbcTemplate.update("UPDATE user_weekly_active_time SET updated_at = LOCALTIMESTAMP - interval '31 seconds' WHERE user_id = ?", account.id());
        pulse(account, false, 31);
        jdbcTemplate.update("UPDATE user_weekly_active_time SET updated_at = LOCALTIMESTAMP - interval '10 minutes' WHERE user_id = ?", account.id());
        pulse(account, true, 31);
        jdbcTemplate.update("UPDATE user_weekly_active_time SET updated_at = LOCALTIMESTAMP - interval '10 minutes' WHERE user_id = ?", account.id());
        pulse(account, true, 91);
        pulse(account, true, 91);
        assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM user_weekly_active_time WHERE user_id = ?", Integer.class, account.id()));
    }

    @Test
    void bootstrapIncludesPreferencesAndRankEndpointStaysSmall() throws Exception {
        var account = account(Role.USER);
        getAs(account, "/api/user/me").andExpect(status().isOk())
                .andExpect(jsonPath("$.onboarding.avatarConfirmed").isBoolean())
                .andExpect(jsonPath("$.notificationPreferences.friendRequests").isBoolean());
        getAs(account, "/api/ranking/me").andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(account.username()))
                .andExpect(jsonPath("$.ranking").doesNotExist());
    }

    @Test
    void includesDuelRecordsForBothFriendshipDirectionsInRealtime() throws Exception {
        var first = account(Role.USER);
        var second = account(Role.USER);
        jdbcTemplate.update("INSERT INTO friendships(requester_id, receiver_id, status, requester_wins, receiver_wins, created_at) VALUES (?, ?, 'ACCEPTED', 3, 2, LOCALTIMESTAMP)", first.id(), second.id());
        getAs(first, "/api/realtime/state").andExpect(status().isOk())
                .andExpect(jsonPath("$.friends[0].username").value(second.username()))
                .andExpect(jsonPath("$.friends[0].winsAgainst").value(3))
                .andExpect(jsonPath("$.friends[0].lossesAgainst").value(2));
        getAs(second, "/api/realtime/state").andExpect(status().isOk())
                .andExpect(jsonPath("$.friends[0].winsAgainst").value(2))
                .andExpect(jsonPath("$.friends[0].lossesAgainst").value(3));
    }

    private void pulse(Account account, boolean active, int expected) throws Exception {
        postJson(account, "/api/user/me/active-time", "{\"active\":" + active + ",\"deltaSeconds\":999999}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.secondsThisWeek").value(expected));
    }
}
