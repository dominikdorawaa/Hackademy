package com.hackademy.server;

import com.hackademy.server.user.Role;
import org.junit.jupiter.api.Test;
import java.util.UUID;
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
}
