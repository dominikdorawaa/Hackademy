package com.hackademy.server;

import com.hackademy.server.user.Role;
import org.junit.jupiter.api.Test;

import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class OnboardingIntegrationTest extends PostgresIntegrationTest {
    private static final String URL = "/api/user/me/onboarding";
    private static final String AVATAR = """
            {"outfit":"bluza","hair":"irokez","hat":"brak","skin":"oliwkowa","hairColor":"niebieskie","topColor":"bordowy","bottomColor":"granatowy","shoesColor":"bialy","hatColor":"czerwony","pose":"profil"}
            """;

    @Test
    void aNewAccountStartsWithoutAConfirmedAvatarOrTour() throws Exception {
        var user = account(Role.USER);
        getAs(user, URL).andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarConfirmed").value(false))
                .andExpect(jsonPath("$.tourStatus").value("PENDING"));
        getAs(user, "/api/user/me").andExpect(jsonPath("$.onboarding.avatarConfirmed").value(false))
                .andExpect(jsonPath("$.avatar").value(nullValue()))
                .andExpect(jsonPath("$.avatarSeed").doesNotExist());
    }

    @Test
    void confirmingSavesTheAvatarAndMarksTheStep() throws Exception {
        var user = account(Role.USER);
        postJson(user, URL + "/tour", "{\"status\":\"SKIPPED\"}").andExpect(status().isConflict());
        postJson(user, URL + "/avatar", AVATAR.replace("\"bluza\"", "\"pirat\"")).andExpect(status().isBadRequest());
        getAs(user, URL).andExpect(jsonPath("$.avatarConfirmed").value(false));
        assertEquals(0, jdbcTemplate.queryForObject("SELECT count(*) FROM user_avatars WHERE user_id = ?", Integer.class, user.id()));

        postJson(user, URL + "/avatar", AVATAR).andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarConfirmed").value(true))
                .andExpect(jsonPath("$.tourStatus").value("PENDING"));
        getAs(user, "/api/user/me").andExpect(jsonPath("$.avatar.outfit").value("bluza"))
                .andExpect(jsonPath("$.avatar.pose").value("profil"))
                .andExpect(jsonPath("$.onboarding.avatarConfirmed").value(true));
        postJson(user, URL + "/avatar", AVATAR.replace("\"irokez\"", "\"kucyk\"")).andExpect(status().isOk());
        getAs(user, "/api/user/me/avatar").andExpect(jsonPath("$.hair").value("kucyk"));
    }

    @Test
    void theTourIsFinishedOnceAndStaysFinished() throws Exception {
        var user = account(Role.USER);
        postJson(user, URL + "/avatar", AVATAR).andExpect(status().isOk());
        postJson(user, URL + "/tour", "{\"status\":\"PENDING\"}").andExpect(status().isBadRequest());
        postJson(user, URL + "/tour", "{}").andExpect(status().isBadRequest());
        postJson(user, URL + "/tour", "{\"status\":\"SKIPPED\"}").andExpect(status().isOk())
                .andExpect(jsonPath("$.tourStatus").value("SKIPPED"));
        postJson(user, URL + "/tour", "{\"status\":\"COMPLETED\"}").andExpect(status().isOk())
                .andExpect(jsonPath("$.tourStatus").value("SKIPPED"));
        getAs(user, "/api/user/me").andExpect(jsonPath("$.onboarding.tourStatus").value("SKIPPED"));
    }

    @Test
    void onboardingNeedsAnAccount() throws Exception {
        mockMvc.perform(get(URL))
                .andExpect(status().isUnauthorized());
    }
}
