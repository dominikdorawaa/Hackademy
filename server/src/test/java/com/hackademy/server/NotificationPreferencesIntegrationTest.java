package com.hackademy.server;

import com.hackademy.server.user.Role;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.ResultActions;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class NotificationPreferencesIntegrationTest extends PostgresIntegrationTest {
    private static final String URL = "/api/user/me/notification-preferences";

    private ResultActions patchPreference(Account account, String body) throws Exception {
        return mockMvc.perform(patch(URL).header("Authorization", "Bearer " + account.token())
                .contentType("application/json").content(body));
    }

    @Test
    void changingOneFieldDoesNotUndoAnotherTabsChange() throws Exception {
        var user = account(Role.USER);
        getAs(user, URL).andExpect(jsonPath("$.friendRequests").value(true));
        getAs(user, URL).andExpect(jsonPath("$.sound").value(true));
        patchPreference(user, "{\"preference\":\"friendRequests\",\"enabled\":false}").andExpect(status().isOk());
        patchPreference(user, "{\"preference\":\"sound\",\"enabled\":false}").andExpect(status().isOk())
                .andExpect(jsonPath("$.friendRequests").value(false)).andExpect(jsonPath("$.sound").value(false));
        getAs(user, URL).andExpect(jsonPath("$.friendRequests").value(false)).andExpect(jsonPath("$.sound").value(false));
    }

    @Test
    void concurrentFirstSavesPreserveBothChangedFields() throws Exception {
        var user = account(Role.USER);
        var gate = new CountDownLatch(1);
        var first = CompletableFuture.runAsync(() -> {
            try {
                gate.await();
                patchPreference(user, "{\"preference\":\"friendRequests\",\"enabled\":false}").andExpect(status().isOk());
            } catch (Exception exception) { throw new RuntimeException(exception); }
        });
        var second = CompletableFuture.runAsync(() -> {
            try {
                gate.await();
                patchPreference(user, "{\"preference\":\"sound\",\"enabled\":false}").andExpect(status().isOk());
            } catch (Exception exception) { throw new RuntimeException(exception); }
        });
        gate.countDown();
        CompletableFuture.allOf(first, second).get(10, TimeUnit.SECONDS);
        getAs(user, URL).andExpect(jsonPath("$.friendRequests").value(false)).andExpect(jsonPath("$.sound").value(false));
    }

    @Test
    void savesPreferencesAcrossRequestsAndIsolatesAccounts() throws Exception {
        var first = account(Role.USER);
        var second = account(Role.USER);
        getAs(first, URL).andExpect(status().isOk())
                .andExpect(jsonPath("$.friendRequests").value(true))
                .andExpect(jsonPath("$.sound").value(true));
        patchPreference(first, """
                {"preference":"friendRequests","enabled":false}
                """)
                .andExpect(status().isOk()).andExpect(jsonPath("$.friendRequests").value(false));
        getAs(first, URL).andExpect(status().isOk())
                .andExpect(jsonPath("$.friendRequests").value(false))
                .andExpect(jsonPath("$.sound").value(true))
                .andExpect(jsonPath("$.browserNotifications").value(false));
        getAs(second, URL).andExpect(status().isOk())
                .andExpect(jsonPath("$.friendRequests").value(true))
                .andExpect(jsonPath("$.browserNotifications").value(false));
    }

    @Test
    void rejectsIncompletePreferencesWithoutOverwritingPreviousValues() throws Exception {
        var user = account(Role.USER);
        patchPreference(user, "{\"sound\":false}").andExpect(status().isBadRequest());
        getAs(user, URL).andExpect(status().isOk()).andExpect(jsonPath("$.sound").value(true));
    }

    @Test
    void requiresAuthentication() throws Exception {
        mockMvc.perform(get(URL)).andExpect(status().isForbidden());
        mockMvc.perform(patch(URL).contentType("application/json")
                .content("{\"preference\":\"sound\",\"enabled\":true}")).andExpect(status().isForbidden());
    }

    @Test
    void rejectsUnknownPreferencesAndMissingValues() throws Exception {
        var user = account(Role.USER);
        patchPreference(user, "{\"preference\":\"unknown\",\"enabled\":true}").andExpect(status().isBadRequest());
        patchPreference(user, "{\"preference\":\"sound\"}").andExpect(status().isBadRequest());
        patchPreference(user, "{\"preference\":\"sound\",\"enabled\":null}").andExpect(status().isBadRequest());
        getAs(user, URL).andExpect(jsonPath("$.sound").value(true));
    }
}
