package com.hackademy.server;

import com.hackademy.server.user.Role;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class UkosIntegrationTest extends PostgresIntegrationTest {
    private static final String URL = "/api/ukos/lab-1";

    @Test
    void progressIsPrivateMonotonicAndDoesNotAwardPoints() throws Exception {
        var alice = account(Role.USER);
        var bob = account(Role.USER);
        mockMvc.perform(get(URL)).andExpect(status().isUnauthorized());
        getAs(alice, URL).andExpect(status().isOk()).andExpect(jsonPath("$.completedSteps").value(0));
        putJson(alice, URL + "/progress", "{\"completedSteps\":7}").andExpect(status().isOk()).andExpect(jsonPath("$.completedSteps").value(7));
        putJson(alice, URL + "/progress", "{\"completedSteps\":2}").andExpect(jsonPath("$.completedSteps").value(7));
        getAs(bob, URL).andExpect(jsonPath("$.completedSteps").value(0));
        putJson(alice, URL + "/progress", "{\"completedSteps\":15}").andExpect(status().isOk()).andExpect(jsonPath("$.completedSteps").value(15));
        putJson(alice, URL + "/progress", "{\"completedSteps\":16}").andExpect(status().isBadRequest());
        putJson(alice, URL + "/progress", "{\"completedSteps\":-1}").andExpect(status().isBadRequest());
        putJson(alice, URL + "/progress", "{}").andExpect(status().isBadRequest());
        assertEquals(0, jdbcTemplate.queryForObject("SELECT points FROM users WHERE id = ?", Integer.class, alice.id()));
    }
}
