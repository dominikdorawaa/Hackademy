package com.hackademy.server;

import com.hackademy.server.user.Role;
import org.junit.jupiter.api.Test;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CtfRoomsInPathsIntegrationTest extends PostgresIntegrationTest {

    @Test
    void tutorialsInTheStarterPathKeepTheirUnlockOrderAndGrantVpnAccess() throws Exception {
        long path = insert("INSERT INTO paths (title, description, published, unlock_mode, created_at, updated_at) VALUES ('Pierwsze kroki', 'd', true, 'OPEN', now(), now()) RETURNING id");
        long chapter = insert("INSERT INTO path_chapters (path_id, title, sort_order, created_at, updated_at) VALUES (" + path + ", 'Samouczki', 0, now(), now()) RETURNING id");
        long vm = tutorial("Tutorial VM", "vm");
        long vpn = tutorial("Tutorial VPN", "vpn");
        long vpnRoom = insert("""
                INSERT INTO rooms (title, description, difficulty, category, points, solutions_count, requires_vpn, room_type, created_at, updated_at)
                VALUES ('%s', 'd', 'MEDIUM', 'Web', 100, 0, true, 'CTF', now(), now()) RETURNING id
                """.formatted(uniqueTitle("Sieć")));
        try {
            jdbcTemplate.update("INSERT INTO chapter_rooms (room_id, chapter_id, sort_order) VALUES (?, ?, 0), (?, ?, 1), (?, ?, 2)", vm, chapter, vpn, chapter, vpnRoom, chapter);
            var player = account(Role.USER);
            postJson(player, "/api/paths/" + path + "/enroll", "{}").andExpect(status().isOk());

            getAs(player, "/api/paths/" + path)
                    .andExpect(jsonPath("$.chapters[0].rooms[0].title").value("Tutorial VM"))
                    .andExpect(jsonPath("$.chapters[0].rooms[0].locked").value(false))
                    .andExpect(jsonPath("$.chapters[0].rooms[1].title").value("Tutorial VPN"))
                    .andExpect(jsonPath("$.chapters[0].rooms[1].locked").value(true))
                    .andExpect(jsonPath("$.chapters[0].rooms[2].locked").value(true));

            solve(player, vm, "vm");
            getAs(player, "/api/paths/" + path)
                    .andExpect(jsonPath("$.chapters[0].rooms[0].solved").value(true))
                    .andExpect(jsonPath("$.chapters[0].rooms[1].locked").value(false))
                    .andExpect(jsonPath("$.chapters[0].rooms[2].locked").value(true));
            getAs(player, "/api/user/me").andExpect(jsonPath("$.hasVpnAccess").value(true));

            solve(player, vpn, "vpn");
            getAs(player, "/api/paths/" + path).andExpect(jsonPath("$.chapters[0].rooms[2].locked").value(false));
            getAs(player, "/api/rooms/" + vpnRoom).andExpect(status().isOk());
        } finally {
            jdbcTemplate.update("DELETE FROM rooms WHERE id IN (?, ?, ?)", vm, vpn, vpnRoom);
            jdbcTemplate.update("DELETE FROM paths WHERE id = ?", path);
        }
    }

    @Test
    void movedCtfRoomStaysReachableByItsOldLinkWithoutEnrolling() throws Exception {
        var admin = account(Role.ADMIN);
        var player = account(Role.USER);
        long path = insert("INSERT INTO paths (title, description, published, unlock_mode, created_at, updated_at) VALUES ('Zadania CTF', 'd', true, 'OPEN', now(), now()) RETURNING id");
        long chapter = insert("INSERT INTO path_chapters (path_id, title, sort_order, created_at, updated_at) VALUES (" + path + ", 'Rozdział 1', 0, now(), now()) RETURNING id");
        long room = createRoom(admin, uniqueTitle("Moved"), "CTF");
        addFlagTask(room, "FLAG{moved}");
        jdbcTemplate.update("INSERT INTO chapter_rooms (room_id, chapter_id, sort_order) VALUES (?, ?, 0)", room, chapter);

        getAs(player, "/api/rooms/" + room).andExpect(status().isOk());
        solve(player, room, "FLAG{moved}");
        getAs(admin, "/api/admin/rooms")
                .andExpect(jsonPath("$[?(@.id == " + room + ")].pathTitle").value(hasItem("Zadania CTF")))
                .andExpect(jsonPath("$[?(@.id == " + room + ")].roomType").value(hasItem("CTF")));
        mockMvc.perform(get("/api/rooms").header("Authorization", "Bearer " + player.token()))
                .andExpect(status().is4xxClientError());
        getAs(admin, "/api/admin/stats?range=7")
                .andExpect(jsonPath("$.solvesBySource[*].key").value(not(hasItem("ctf"))));
    }

    private long tutorial(String title, String flag) {
        long room = insert("""
                INSERT INTO rooms (title, description, difficulty, category, points, solutions_count, requires_vpn, room_type, created_at, updated_at)
                VALUES ('%s', 'd', 'EASY', 'Tutorial', 50, 0, false, 'CTF', now(), now()) RETURNING id
                """.formatted(title));
        addFlagTask(room, flag);
        return room;
    }

    private void solve(Account account, long room, String flag) throws Exception {
        solveRoom(account, room, flag)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    private long insert(String sql) {
        return jdbcTemplate.queryForObject(sql, Long.class);
    }
}
