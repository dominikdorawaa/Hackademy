package com.hackademy.server;

import com.hackademy.server.user.Role;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import java.util.List;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class EmptyBadgeShowcaseIntegrationTest extends PostgresIntegrationTest {
    @Test
    void preservesExplicitOrderAndClearsSelectionWithoutDeletingEarnedBadges() throws Exception {
        var owner = account(Role.USER);
        var viewer = account(Role.USER);
        var ids = jdbcTemplate.queryForList("SELECT id FROM badges ORDER BY id LIMIT 3", Long.class);
        for (var id : ids) {
            jdbcTemplate.update("INSERT INTO user_badges (user_id, badge_id, earned_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING", owner.id(), id);
        }
        var order = List.of(ids.get(2), ids.get(0), ids.get(1));
        var body = """
                {"bio":"Existing bio","tagline":"","interests":[],"featuredBadgeIds":%s}
                """.formatted(order);
        mockMvc.perform(MockMvcRequestBuilders.patch("/api/user/me/profile")
                .header("Authorization", "Bearer " + owner.token()).contentType("application/json").content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.featuredBadgeIds", hasSize(3)));
        getAs(owner, "/api/user/me").andExpect(status().isOk())
                .andExpect(jsonPath("$.featuredBadgeIds[0]").value(order.get(0).intValue()))
                .andExpect(jsonPath("$.featuredBadgeIds[1]").value(order.get(1).intValue()))
                .andExpect(jsonPath("$.featuredBadgeIds[2]").value(order.get(2).intValue()));
        getAs(viewer, "/api/user/" + owner.username()).andExpect(status().isOk())
                .andExpect(jsonPath("$.featuredBadgeIds[0]").value(order.get(0).intValue()));
        mockMvc.perform(MockMvcRequestBuilders.patch("/api/user/me/profile")
                .header("Authorization", "Bearer " + owner.token()).contentType("application/json")
                .content(body.replace(order.toString(), "[]")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.featuredBadgeIds", hasSize(0)));
        getAs(owner, "/api/user/me").andExpect(status().isOk()).andExpect(jsonPath("$.featuredBadgeIds", hasSize(0)));
        getAs(viewer, "/api/user/" + owner.username()).andExpect(status().isOk())
                .andExpect(jsonPath("$.featuredBadgeIds", hasSize(0)));
        assertTrue(jdbcTemplate.queryForObject("SELECT count(*) FROM user_badges WHERE user_id = ?", Integer.class, owner.id()) >= 3);
    }
}
