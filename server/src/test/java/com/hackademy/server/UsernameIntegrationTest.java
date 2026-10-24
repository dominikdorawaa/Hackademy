package com.hackademy.server;

import com.hackademy.server.user.Role;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.ResultActions;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class UsernameIntegrationTest extends PostgresIntegrationTest {

    private ResultActions rename(Account account, String name) throws Exception {
        return mockMvc.perform(patch("/api/user/me/username").header("Authorization", "Bearer " + account.token())
                .contentType("application/json").content("{\"newUsername\":\"" + name + "\"}"));
    }

    @Test
    void refusesANameTakenInAnyLetterCaseWithAPolishMessage() throws Exception {
        var owner = account(Role.USER);
        var other = account(Role.USER);
        rename(other, other.username().toUpperCase()).andExpect(status().isOk());
        rename(owner, other.username().toLowerCase()).andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Ta nazwa jest zajęta"));
        getAs(owner, "/api/user/me/username/availability?name=" + other.username().toLowerCase()).andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(false)).andExpect(jsonPath("$.reason").value("taken"))
                .andExpect(jsonPath("$.message").value("Ta nazwa jest zajęta"));
    }

    @Test
    void checksLengthAndCharactersTheSameWayAsTheRename() throws Exception {
        var owner = account(Role.USER);
        rename(owner, "zła nazwa").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.newUsername").value("Nazwa może zawierać tylko litery, cyfry, _ i -"));
        rename(owner, "ab").andExpect(status().isBadRequest());
        getAs(owner, "/api/user/me/username/availability?name=ab").andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.message").value("Nazwa użytkownika musi mieć od 3 do 20 znaków"));
        getAs(owner, "/api/user/me/username/availability?name=zła-nazwa").andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.message").value("Nazwa może zawierać tylko litery, cyfry, _ i -"));
    }

    @Test
    void keepsTheOwnNameAvailableAndSavesAFreeOne() throws Exception {
        var owner = account(Role.USER);
        getAs(owner, "/api/user/me/username/availability?name=" + owner.username().toUpperCase())
                .andExpect(jsonPath("$.available").value(true));
        getAs(owner, "/api/ranking/summary").andExpect(jsonPath("$.myRank.username").value(owner.username()));
        getAs(owner, "/api/dashboard/summary").andExpect(jsonPath("$.user.username").value(owner.username()));
        var fresh = "Nowy_" + owner.id();
        getAs(owner, "/api/user/me/username/availability?name=" + fresh).andExpect(jsonPath("$.available").value(true));
        rename(owner, fresh).andExpect(status().isOk()).andExpect(jsonPath("$.username").value(fresh));
        getAs(owner, "/api/user/me").andExpect(jsonPath("$.username").value(fresh));
        getAs(owner, "/api/ranking/summary").andExpect(jsonPath("$.myRank.username").value(fresh));
        getAs(owner, "/api/dashboard/summary").andExpect(jsonPath("$.user.username").value(fresh));
    }
}
