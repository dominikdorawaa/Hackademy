package com.hackademy.server;

import com.hackademy.server.user.Role;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.UUID;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AdminPagesIntegrationTest extends PostgresIntegrationTest {
    @Test
    void searchesUsersAcrossPagesAndCapsPageSize() throws Exception {
        var admin = account(Role.ADMIN);
        String prefix = UUID.randomUUID().toString().substring(0, 8);
        jdbcTemplate.update("""
                INSERT INTO users(username, email, password, role, points, elo, streak, bio, created_at, updated_at)
                SELECT ? || n, ? || n || '@example.invalid', 'p', 'USER', 0, 500, 0, '', LOCALTIMESTAMP, LOCALTIMESTAMP
                FROM generate_series(1, 41) n
                """, prefix, prefix);
        String url = "/api/admin/users?query=" + prefix + "&size=20&page=";
        getAs(admin, url + 0).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(20))
                .andExpect(jsonPath("$.hasNext").value(true));
        getAs(admin, url + 1).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(20))
                .andExpect(jsonPath("$.page").value(1)).andExpect(jsonPath("$.hasNext").value(true));
        getAs(admin, url + 2).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.hasNext").value(false));
        getAs(admin, "/api/admin/users?query=" + prefix + "&size=99999&page=-1").andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(100)).andExpect(jsonPath("$.page").value(0));
        getAs(account(Role.EXPERT), url + 0).andExpect(status().isForbidden());
    }

    @Test
    void bugReportsHaveBoundedPagesAndRemainRestrictedToAdministrators() throws Exception {
        var admin = account(Role.ADMIN);
        jdbcTemplate.update("""
                INSERT INTO bug_reports (reporter_id, source, description, status, created_at)
                SELECT ?, 'ARENA', 'Zgłoszenie testowe ' || n, 'OPEN', LOCALTIMESTAMP
                FROM generate_series(1, 53) AS n
                """, admin.id());
        getAs(admin, "/api/admin/bug-reports?size=20").andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(20)).andExpect(jsonPath("$.hasNext").value(true));
        getAs(admin, "/api/admin/bug-reports?size=20&page=1").andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(20)).andExpect(jsonPath("$.page").value(1));
        getAs(account(Role.EXPERT), "/api/admin/bug-reports").andExpect(status().isForbidden());
        getAs(account(Role.USER), "/api/admin/bug-reports").andExpect(status().isForbidden());
    }

    @Test
    void roomsArePagedSearchedAcrossPagesFilteredByTypeAndCountedOnTheServer() throws Exception {
        var admin = account(Role.ADMIN);
        String prefix = UUID.randomUUID().toString().substring(0, 8);
        jdbcTemplate.update("""
                INSERT INTO rooms (title, description, difficulty, category, points, solutions_count, requires_vpn, room_type, created_at, updated_at)
                SELECT ? || '-' || lpad(n::text, 3, '0'), 'd', 'MEDIUM', 'Seed', CASE WHEN n % 3 = 0 THEN 100 ELSE 10 END, 0, false,
                       CASE WHEN n % 3 = 0 THEN 'CTF' ELSE 'PATH' END, now(), now()
                FROM generate_series(1, 120) n
                """, prefix);
        long path = jdbcTemplate.queryForObject("INSERT INTO paths (title, published, created_at, updated_at) VALUES (?, false, now(), now()) RETURNING id",
                Long.class, "Ścieżka " + prefix.toUpperCase());
        long chapter = jdbcTemplate.queryForObject("INSERT INTO path_chapters (path_id, title, sort_order, created_at, updated_at) VALUES (?, 'A', 0, now(), now()) RETURNING id",
                Long.class, path);
        long owned = createRoom(admin, uniqueTitle("Owned"), "PATH");
        jdbcTemplate.update("INSERT INTO chapter_rooms (room_id, chapter_id, sort_order) VALUES (?, ?, 0)", owned, chapter);
        long first = jdbcTemplate.queryForObject("SELECT id FROM rooms WHERE title = ?", Long.class, prefix + "-001");

        String url = "/api/admin/rooms?query=" + prefix + "&page=";
        String firstPage = getAs(admin, url + 0).andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(50)).andExpect(jsonPath("$.size").value(50))
                .andExpect(jsonPath("$.hasNext").value(true)).andExpect(jsonPath("$.items[0].id").value(first))
                .andExpect(jsonPath("$.counts.PATH").value(81)).andExpect(jsonPath("$.counts.CTF").value(40))
                .andReturn().getResponse().getContentAsString();
        List<Number> ids = JsonPath.read(firstPage, "$.items[*].id");
        assertEquals(ids.stream().map(Number::longValue).sorted().toList(), ids.stream().map(Number::longValue).toList());
        getAs(admin, url + 1).andExpect(jsonPath("$.items.length()").value(50)).andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.items[0].title").value(prefix + "-051")).andExpect(jsonPath("$.hasNext").value(true));
        getAs(admin, url + 2).andExpect(jsonPath("$.items.length()").value(21)).andExpect(jsonPath("$.hasNext").value(false))
                .andExpect(jsonPath("$.items[20].id").value(owned))
                .andExpect(jsonPath("$.items[20].paths[0].title").value("Ścieżka " + prefix.toUpperCase()));
        getAs(admin, url + 9).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(0))
                .andExpect(jsonPath("$.page").value(9)).andExpect(jsonPath("$.hasNext").value(false));

        getAs(admin, "/api/admin/rooms?query=" + prefix.toUpperCase() + "-119").andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].title").value(prefix + "-119")).andExpect(jsonPath("$.hasNext").value(false))
                .andExpect(jsonPath("$.counts.PATH").value(1)).andExpect(jsonPath("$.counts.CTF").value(0));
        getAs(admin, url + 0 + "&type=CTF").andExpect(jsonPath("$.items.length()").value(40))
                .andExpect(jsonPath("$.items[*].roomType", everyItem(is("CTF")))).andExpect(jsonPath("$.hasNext").value(false))
                .andExpect(jsonPath("$.counts.PATH").value(81)).andExpect(jsonPath("$.counts.CTF").value(40));
        getAs(admin, url + 1 + "&type=PATH&size=40").andExpect(jsonPath("$.items.length()").value(40))
                .andExpect(jsonPath("$.items[*].roomType", everyItem(is("PATH")))).andExpect(jsonPath("$.hasNext").value(true));
        getAs(admin, "/api/admin/rooms?query=" + prefix + "&size=99999&page=-3").andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(100)).andExpect(jsonPath("$.page").value(0)).andExpect(jsonPath("$.items.length()").value(100));
        getAs(admin, "/api/admin/rooms?query=" + prefix + "&size=0").andExpect(jsonPath("$.size").value(1));
        getAs(admin, "/api/admin/rooms?type=LESSON").andExpect(status().isBadRequest());
        getAs(admin, "/api/admin/rooms?query=" + UUID.randomUUID()).andExpect(jsonPath("$.items.length()").value(0))
                .andExpect(jsonPath("$.counts.PATH").value(0)).andExpect(jsonPath("$.counts.CTF").value(0));
        getAs(admin, "/api/admin/rooms?query=" + "x".repeat(64) + prefix).andExpect(jsonPath("$.items.length()").value(0));

        getAs(account(Role.EXPERT), url + 0).andExpect(status().isOk());
        getAs(account(Role.USER), url + 0).andExpect(status().isForbidden());
        getAs(admin, "/api/admin/rooms/all").andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + owned + ")].paths[*].id").value(hasItem((int) path)));
        getAs(account(Role.USER), "/api/admin/rooms/all").andExpect(status().isForbidden());
    }

    @Test
    void pathsArePagedAndSearchedByTitleWithoutCase() throws Exception {
        var admin = account(Role.ADMIN);
        String prefix = UUID.randomUUID().toString().substring(0, 8);
        jdbcTemplate.update("""
                INSERT INTO paths (title, published, created_at, updated_at)
                SELECT 'Ścieżka ' || ? || '-' || lpad(n::text, 2, '0'), n % 2 = 0, now(), now()
                FROM generate_series(1, 55) n
                """, prefix);
        long last = jdbcTemplate.queryForObject("SELECT id FROM paths WHERE title = ?", Long.class, "Ścieżka " + prefix + "-55");
        long chapter = jdbcTemplate.queryForObject("INSERT INTO path_chapters (path_id, title, sort_order, created_at, updated_at) VALUES (?, 'A', 0, now(), now()) RETURNING id",
                Long.class, last);
        long room = createRoom(admin, uniqueTitle("Counted"), "PATH");
        jdbcTemplate.update("INSERT INTO chapter_rooms (room_id, chapter_id, sort_order) VALUES (?, ?, 0)", room, chapter);

        String url = "/api/admin/paths?query=ŚCIEŻKA " + prefix.toUpperCase() + "&page=";
        getAs(admin, url + 0).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(50))
                .andExpect(jsonPath("$.hasNext").value(true)).andExpect(jsonPath("$.items[0].title").value("Ścieżka " + prefix + "-01"))
                .andExpect(jsonPath("$.items[0].published").value(false)).andExpect(jsonPath("$.items[1].published").value(true));
        getAs(admin, url + 1).andExpect(jsonPath("$.items.length()").value(5)).andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.hasNext").value(false)).andExpect(jsonPath("$.items[4].id").value(last))
                .andExpect(jsonPath("$.items[4].roomsCount").value(1)).andExpect(jsonPath("$.items[3].roomsCount").value(0));
        getAs(admin, url + 5).andExpect(jsonPath("$.items.length()").value(0)).andExpect(jsonPath("$.hasNext").value(false));
        getAs(admin, "/api/admin/paths?query=" + prefix + "-4").andExpect(jsonPath("$.items.length()").value(10));
        getAs(admin, "/api/admin/paths?query=" + prefix + "&size=500&page=-1").andExpect(jsonPath("$.size").value(100))
                .andExpect(jsonPath("$.page").value(0)).andExpect(jsonPath("$.items.length()").value(55));
        getAs(admin, "/api/admin/paths?query=" + "x".repeat(64) + prefix).andExpect(jsonPath("$.items.length()").value(0));
        getAs(account(Role.EXPERT), url + 0).andExpect(status().isOk());
        getAs(account(Role.USER), url + 0).andExpect(status().isForbidden());
    }
}
