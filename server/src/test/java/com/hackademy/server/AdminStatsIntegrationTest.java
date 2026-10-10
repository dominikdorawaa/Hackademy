package com.hackademy.server;

import com.hackademy.server.dashboard.ActivityWeek;
import com.hackademy.server.user.Role;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AdminStatsIntegrationTest extends PostgresIntegrationTest {

    @Test
    void restrictsStatisticsToAdministrators() throws Exception {
        getAs(account(Role.USER), "/api/admin/stats").andExpect(status().isForbidden());
        getAs(account(Role.EXPERT), "/api/admin/stats").andExpect(status().isForbidden());
        var admin = account(Role.ADMIN);
        getAs(admin, "/api/admin/stats").andExpect(status().isOk()).andExpect(jsonPath("$.rangeDays").value(30));
        getAs(admin, "/api/admin/stats?range=15").andExpect(status().isBadRequest());
        getAs(admin, "/api/admin/stats?range=week").andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/admin/stats"))
                .andExpect(status().isForbidden());
    }

    @Test
    void summarizesPlatformActivity() throws Exception {
        jdbcTemplate.update("DELETE FROM users");
        jdbcTemplate.update("DELETE FROM rooms");
        jdbcTemplate.update("DELETE FROM paths");

        var admin = account(Role.ADMIN);
        var alice = account(Role.USER);
        var bob = account(Role.USER);
        jdbcTemplate.update("UPDATE users SET created_at = now() - interval '10 days' WHERE id = ?", bob.id());

        long ctf = createRoom(admin, uniqueTitle("Ctf"), "CTF");
        long unassigned = createRoom(admin, uniqueTitle("Loose"), "PATH");
        List<Long> pathRooms = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            long room = createRoom(admin, uniqueTitle("Path room " + i), "PATH");
            long path = jdbcTemplate.queryForObject(
                    "INSERT INTO paths (title, created_at, updated_at) VALUES (?, now(), now()) RETURNING id", Long.class, "Path " + i);
            long chapter = jdbcTemplate.queryForObject(
                    "INSERT INTO path_chapters (path_id, title, sort_order, created_at, updated_at) VALUES (?, 'Rozdział 1', 0, now(), now()) RETURNING id",
                    Long.class, path);
            jdbcTemplate.update("INSERT INTO chapter_rooms (room_id, chapter_id, sort_order) VALUES (?, ?, 0)", room, chapter);
            pathRooms.add(room);
        }

        solve(alice, ctf, "now() - interval '2 days'");
        solve(bob, ctf, "now() - interval '40 days'");
        solve(alice, unassigned, "now() - interval '1 day'");
        solve(alice, pathRooms.get(0), "now() - interval '3 hours'");
        solve(bob, pathRooms.get(0), "now() - interval '5 days'");
        solve(alice, pathRooms.get(1), "now() - interval '6 days'");
        solve(alice, pathRooms.get(2), "now() - interval '20 days'");
        solve(alice, pathRooms.get(4), "now() - interval '100 days'");
        solve(alice, pathRooms.get(5), "now() - interval '1 hour'");

        jdbcTemplate.update("INSERT INTO user_weekly_active_time (user_id, week_key, seconds, updated_at) VALUES (?, ?, 120, now())",
                alice.id(), ActivityWeek.currentKey());
        jdbcTemplate.update("INSERT INTO user_weekly_active_time (user_id, week_key, seconds, updated_at) VALUES (?, ?, 0, now())",
                bob.id(), ActivityWeek.currentKey());
        jdbcTemplate.update("INSERT INTO user_weekly_active_time (user_id, week_key, seconds, updated_at) VALUES (?, '1999-W01', 50, now())",
                bob.id());
        jdbcTemplate.update("""
                INSERT INTO chat_messages (game_id, sender_id, sender_username, content, reported, sent_at)
                VALUES ('g', ?, 'a', 'zgłoszona', true, now()), ('g', ?, 'a', 'zwykła', false, now())
                """, alice.id(), alice.id());

        String today = LocalDate.now().toString();
        getAs(admin, "/api/admin/stats?range=7")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totals.users").value(3))
                .andExpect(jsonPath("$.totals.solves").value(9))
                .andExpect(jsonPath("$.totals.activeThisWeek").value(1))
                .andExpect(jsonPath("$.totals.pendingReports").value(1))
                .andExpect(jsonPath("$.rangeDays").value(7))
                .andExpect(jsonPath("$.timeline.length()").value(7))
                .andExpect(jsonPath("$.timeline[0].date").value(LocalDate.now().minusDays(6).toString()))
                .andExpect(jsonPath("$.timeline[6].date").value(today))
                .andExpect(jsonPath("$.timeline[6].registrations").value(2))
                .andExpect(jsonPath("$.solvesBySource.length()").value(6))
                .andExpect(jsonPath("$.solvesBySource[0].key").value("path-" + pathId(pathRooms.get(0))))
                .andExpect(jsonPath("$.solvesBySource[0].label").value("Path 0"))
                .andExpect(jsonPath("$.solvesBySource[0].count").value(2))
                .andExpect(jsonPath("$.solvesBySource[1].label").value("Path 1"))
                .andExpect(jsonPath("$.solvesBySource[2].label").value("Path 2"))
                .andExpect(jsonPath("$.solvesBySource[3].key").value("paths-other"))
                .andExpect(jsonPath("$.solvesBySource[3].count").value(2))
                .andExpect(jsonPath("$.solvesBySource[4].key").value("paths-unassigned"))
                .andExpect(jsonPath("$.solvesBySource[4].count").value(1))
                .andExpect(jsonPath("$.solvesBySource[5].key").value("ctf"))
                .andExpect(jsonPath("$.solvesBySource[5].count").value(2))
                .andExpect(jsonPath("$.recentSolves[0].roomId").value(pathRooms.get(5)))
                .andExpect(jsonPath("$.recentSolves[0].pathTitle").value("Path 5"))
                .andExpect(jsonPath("$.recentSolves[1].roomId").value(pathRooms.get(0)))
                .andExpect(jsonPath("$.recentSolves[1].username").value(alice.username()))
                .andExpect(jsonPath("$.recentSolves.length()").value(8));

        getAs(admin, "/api/admin/stats?range=90")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timeline.length()").value(90));
    }

    private void solve(Account account, long room, String solvedAt) {
        jdbcTemplate.update("INSERT INTO user_solved_rooms (user_id, room_id, solved_at) VALUES (?, ?, " + solvedAt + ")",
                account.id(), room);
    }

    private long pathId(long room) {
        return jdbcTemplate.queryForObject("""
                SELECT pc.path_id FROM chapter_rooms cr JOIN path_chapters pc ON pc.id = cr.chapter_id WHERE cr.room_id = ?
                """, Long.class, room);
    }
}
