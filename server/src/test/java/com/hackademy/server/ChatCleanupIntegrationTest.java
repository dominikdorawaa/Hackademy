package com.hackademy.server;

import com.hackademy.server.chat.ChatService;
import com.hackademy.server.user.Role;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ChatCleanupIntegrationTest extends PostgresIntegrationTest {

    @Autowired
    ChatService chatService;

    @Test
    void cleanupKeepsOnlyReportedMessagesOfThatGame() throws Exception {
        var alice = account(Role.USER);
        var admin = account(Role.ADMIN);
        String game = "game-" + UUID.randomUUID();
        String otherGame = "game-" + UUID.randomUUID();

        long reported = send(alice, game, "obraźliwa");
        long ordinary = send(alice, game, "gg");
        long elsewhere = send(alice, otherGame, "inna gra");
        mockMvc.perform(post("/api/chat/message/" + reported + "/report")
                        .header("Authorization", "Bearer " + alice.token()))
                .andExpect(status().isOk());

        chatService.cleanupChat(game);

        getAs(alice, "/api/chat/" + game)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(reported));
        getAs(alice, "/api/chat/" + otherGame)
                .andExpect(jsonPath("$[0].id").value(elsewhere));
        getAs(admin, "/api/admin/reports")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", hasItem((int) reported)))
                .andExpect(jsonPath("$[*].id", not(hasItem((int) ordinary))));
    }

    private long send(Account account, String game, String content) throws Exception {
        var result = postJson(account, "/api/chat/" + game + "/send", "{\"content\":\"" + content + "\"}")
                .andExpect(status().isOk())
                .andReturn();
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id")).longValue();
    }
}
