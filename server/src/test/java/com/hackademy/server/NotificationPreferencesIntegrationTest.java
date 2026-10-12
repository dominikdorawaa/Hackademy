package com.hackademy.server;

import com.hackademy.server.user.Role;
import org.junit.jupiter.api.Test;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class NotificationPreferencesIntegrationTest extends PostgresIntegrationTest {
    private static final String URL = "/api/user/me/notification-preferences";

    @Test
    void savesPreferencesAcrossRequestsAndIsolatesAccounts() throws Exception {
        var first = account(Role.USER);
        var second = account(Role.USER);
        getAs(first, URL).andExpect(status().isOk())
                .andExpect(jsonPath("$.friendRequests").value(true))
                .andExpect(jsonPath("$.sound").value(false));
        putJson(first, URL, """
                {"friendRequests":false,"challenges":false,"matchFound":false,"sound":true,"browserNotifications":true}
                """)
                .andExpect(status().isOk()).andExpect(jsonPath("$.sound").value(true));
        getAs(first, URL).andExpect(status().isOk())
                .andExpect(jsonPath("$.friendRequests").value(false))
                .andExpect(jsonPath("$.browserNotifications").value(true));
        getAs(second, URL).andExpect(status().isOk())
                .andExpect(jsonPath("$.friendRequests").value(true))
                .andExpect(jsonPath("$.browserNotifications").value(false));
    }

    @Test
    void rejectsIncompletePreferencesWithoutOverwritingPreviousValues() throws Exception {
        var user = account(Role.USER);
        putJson(user, URL, "{\"sound\":true}").andExpect(status().isBadRequest());
        getAs(user, URL).andExpect(status().isOk()).andExpect(jsonPath("$.sound").value(false));
    }

    @Test
    void requiresAuthentication() throws Exception {
        mockMvc.perform(get(URL)).andExpect(status().isForbidden());
    }
}
