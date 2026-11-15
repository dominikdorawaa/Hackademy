package com.hackademy.server;

import com.hackademy.server.user.Role;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ShopWithoutPaymentsIntegrationTest extends PostgresIntegrationTest {

    @Test
    void keepsTopUpsClosedUntilAPaymentProviderIsConnected() throws Exception {
        var player = account(Role.USER);
        getAs(player, "/api/shop").andExpect(status().isOk()).andExpect(jsonPath("$.topUps").value("off"));
        postJson(player, "/api/shop/top-ups", "{\"packageId\":\"small\"}").andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value("Doładowania Bajtów będą dostępne wkrótce."));
        postJson(player, "/api/shop/top-ups/1/test-payment", "{}").andExpect(status().isNotFound());
        assertEquals(0, jdbcTemplate.queryForObject("SELECT count(*) FROM top_up_orders WHERE user_id = ?", Integer.class, player.id()));
    }
}
