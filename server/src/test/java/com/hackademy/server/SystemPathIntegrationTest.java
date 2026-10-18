package com.hackademy.server;

import com.hackademy.server.user.Role;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.mock.web.MockMultipartFile;
import java.nio.charset.StandardCharsets;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SystemPathIntegrationTest extends PostgresIntegrationTest {
    private static final String LOCKED = "Ścieżka systemowa jest utrzymywana w kodzie. Nie można jej zmieniać ani usuwać w panelu.";

    @Test
    void systemPathIsListedButCannotBeChangedOrDeletedFromThePanel() throws Exception {
        jdbcTemplate.update("""
                INSERT INTO paths (title, published, unlock_mode, system_key, created_at, updated_at)
                VALUES ('Dyżur Zero', true, 'OPEN', 'ukos', now(), now()) ON CONFLICT (system_key) DO NOTHING
                """);
        long id = jdbcTemplate.queryForObject("SELECT id FROM paths WHERE system_key = 'ukos'", Long.class);
        var admin = account(Role.ADMIN);
        var expert = account(Role.EXPERT);
        var user = account(Role.USER);

        getAs(admin, "/api/admin/paths").andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + id + ")].systemKey").value(hasItem("ukos")));
        getAs(admin, "/api/admin/paths/" + id).andExpect(jsonPath("$.systemKey").value("ukos"))
                .andExpect(jsonPath("$.title").value("Dyżur Zero"));

        mockMvc.perform(delete("/api/admin/paths/" + id).header("Authorization", "Bearer " + admin.token()))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.message").value(LOCKED));
        putJson(admin, "/api/admin/paths/" + id, "{\"title\":\"Inna\"}").andExpect(status().isForbidden());
        putJson(expert, "/api/admin/paths/" + id + "/chapters", "{\"revision\":0,\"chapters\":[{\"title\":\"R\",\"roomIds\":[]}]}").andExpect(status().isForbidden());
        var content = new MockMultipartFile("content", "", "application/json",
                "{\"title\":\"Inna\",\"chapters\":[],\"published\":false,\"revision\":0,\"chaptersRevision\":0}".getBytes(StandardCharsets.UTF_8));
        mockMvc.perform(multipart(HttpMethod.PUT, "/api/admin/content/paths/" + id).file(content)
                        .header("Authorization", "Bearer " + admin.token()))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.message").value(LOCKED));

        assertEquals("Dyżur Zero", jdbcTemplate.queryForObject("SELECT title FROM paths WHERE id = ?", String.class, id));
        getAs(user, "/api/paths").andExpect(jsonPath("$[?(@.id == " + id + ")].systemKey").value(hasItem("ukos")));
        getAs(user, "/api/paths/me/progress").andExpect(jsonPath("$[*].id").value(not(hasItem((int) id))));
    }
}
