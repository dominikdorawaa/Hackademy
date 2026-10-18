package com.hackademy.server;

import com.hackademy.server.arena.ArenaService;
import com.hackademy.server.user.Role;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ArenaQuickChatIntegrationTest extends PostgresIntegrationTest {
    @Autowired
    private ArenaService arena;

    private String game(Account first, Account second) {
        var challenge = arena.createChallenge(first.id(), first.username(), second.id(), second.username());
        return arena.acceptChallenge(challenge.getId(), second.id()).getId();
    }

    private Integer elo(Account account) {
        return jdbcTemplate.queryForObject("SELECT elo FROM users WHERE id = ?", Integer.class, account.id());
    }

    @Test
    void onlyPlayersSendAndReadReactions() throws Exception {
        var first = account(Role.USER);
        var second = account(Role.USER);
        var outsider = account(Role.USER);
        String url = "/api/arena/game/" + game(first, second);

        postJson(outsider, url + "/reaction", "{\"reaction\":\"ez\"}").andExpect(status().isNotFound());
        getAs(outsider, url).andExpect(status().isNotFound());
        postJson(first, url + "/reaction", "{\"reaction\":\"hej\"}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Wybierz reakcję z menu."));
        postJson(first, url + "/reaction", "{}").andExpect(status().isBadRequest());

        postJson(first, url + "/reaction", "{\"reaction\":\"67\"}").andExpect(status().isOk());
        getAs(second, url).andExpect(status().isOk())
                .andExpect(jsonPath("$.reactions", hasSize(1)))
                .andExpect(jsonPath("$.reactions[0].reaction").value("67"))
                .andExpect(jsonPath("$.reactions[0].senderId").value(first.id()));

        postJson(first, url + "/reaction", "{\"reaction\":\"ez\"}").andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "2"))
                .andExpect(jsonPath("$.retryAfter").value(2));
        getAs(second, url).andExpect(jsonPath("$.reactions", hasSize(1)));
    }

    @Test
    void mutedPlayersCannotReact() throws Exception {
        var first = account(Role.USER);
        var second = account(Role.USER);
        String url = "/api/arena/game/" + game(first, second);
        jdbcTemplate.update("UPDATE users SET muted_until = '2999-01-01 12:00:00' WHERE id = ?", second.id());

        postJson(second, url + "/reaction", "{\"reaction\":\"gg\"}").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Masz wyciszone reakcje."))
                .andExpect(jsonPath("$.mutedUntil").value("2999-01-01T12:00:00Z"));
        getAs(first, url).andExpect(jsonPath("$.reactions", hasSize(0)));
    }

    @Test
    void outsiderSurrenderIsRejectedWithoutChangingTheGame() throws Exception {
        var first = account(Role.USER);
        var second = account(Role.USER);
        var outsider = account(Role.USER);
        String url = "/api/arena/game/" + game(first, second);
        Integer firstElo = elo(first), secondElo = elo(second);

        postJson(outsider, url + "/surrender", "{}").andExpect(status().isNotFound());
        getAs(first, url).andExpect(jsonPath("$.status").value("ACTIVE"));
        assertEquals(firstElo, elo(first));
        assertEquals(secondElo, elo(second));

        postJson(first, url + "/surrender", "{}").andExpect(status().isOk());
        postJson(second, url + "/surrender", "{}").andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Ta walka jest już zakończona."));
        getAs(second, url).andExpect(jsonPath("$.winnerId").value(second.id()));
    }

    @Test
    void theOldTextChatIsGoneButReportedMessagesStayForModeration() throws Exception {
        var player = account(Role.USER);
        var admin = account(Role.ADMIN);
        jdbcTemplate.update("INSERT INTO chat_messages (game_id, sender_id, sender_username, content, reported, sent_at) VALUES (?, ?, ?, ?, true, now())",
                "old-game", player.id(), player.username(), "zgłoszona");
        Long reported = jdbcTemplate.queryForObject("SELECT id FROM chat_messages WHERE game_id = 'old-game'", Long.class);

        getAs(player, "/api/chat/old-game").andExpect(status().isNotFound());
        postJson(player, "/api/chat/old-game/send", "{\"content\":\"hej\"}").andExpect(status().is4xxClientError());
        postJson(player, "/api/chat/message/" + reported + "/report", "{}").andExpect(status().is4xxClientError());
        getAs(admin, "/api/admin/reports").andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", hasItem(reported.intValue())));
    }
}
