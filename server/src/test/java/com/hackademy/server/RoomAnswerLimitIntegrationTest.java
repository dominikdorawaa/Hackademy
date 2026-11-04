package com.hackademy.server;

import com.hackademy.server.user.Role;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@TestPropertySource(properties = {
        "RATE_LIMIT_ENABLED=true",
        "application.rate-limit.rules.room-answer.burst=2",
        "application.rate-limit.rules.room-answer.limit=2",
        "application.rate-limit.rules.room-answer.window=2h"
})
class RoomAnswerLimitIntegrationTest extends PostgresIntegrationTest {

    @Test
    void wrongFlagsBlockOnlyThatPlayersRoomWithARetryTime() throws Exception {
        var admin = account(Role.ADMIN);
        var player = account(Role.USER);
        var other = account(Role.USER);
        long room = createRoom(admin, uniqueTitle("Guessing room"), "CTF");
        publishInPath(room);
        long second = createRoom(admin, uniqueTitle("Second guessing room"), "CTF");
        publishInPath(second);
        joinPathsOf(player, room, second);
        joinPathsOf(other, room);
        addFlagTask(room, "HACK{flag}");
        addFlagTask(second, "HACK{flag}");

        solveRoom(player, room, "guess-1").andExpect(status().isBadRequest());
        solveRoom(player, room, "hack{flag}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Niepoprawna odpowiedź"));

        solveRoom(player, room, "HACK{flag}")
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "3600"))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().json("""
                        {"message":"Zbyt wiele błędnych odpowiedzi w tym pokoju. Spróbuj ponownie za 3600 s.","retryAfter":3600,"reason":"room-answer"}
                        """, true));

        solveRoom(other, room, "HACK{flag}").andExpect(status().isOk())
                .andExpect(jsonPath("$.pointsEarned").value(50));
        solveRoom(player, second, "HACK{flag}").andExpect(status().isOk());
        solveRoom(player, second, "HACK{flag}").andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Poprawna odpowiedź! (Pokój już ukończony)"));
    }

    @Test
    void theoryAnswersIgnoreLetterCaseAndShareTheLimit() throws Exception {
        var admin = account(Role.ADMIN);
        var player = account(Role.USER);
        long room = createRoom(admin, uniqueTitle("Theory room"), "PATH");
        publishInPath(room);
        joinPathsOf(player, room);
        long task = jdbcTemplate.queryForObject("""
                INSERT INTO room_tasks (room_id, title, content, question, answer, sort_order)
                VALUES (?, 'Pytanie', 'Treść', 'Jakie polecenie?', 'pwd', 0) RETURNING id
                """, Long.class, room);
        String solve = "/api/rooms/" + room + "/tasks/" + task + "/solve";

        postJson(player, solve, "{\"answer\":\"ls\"}").andExpect(status().isBadRequest());
        postJson(player, solve, "{\"answer\":\"PWD\"}").andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Poprawna odpowiedź! Pokój ukończony!"));
    }
}
