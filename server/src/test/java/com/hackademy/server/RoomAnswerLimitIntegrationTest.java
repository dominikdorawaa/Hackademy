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
        long second = createRoom(admin, uniqueTitle("Second guessing room"), "CTF");
        String solve = "/api/rooms/" + room + "/solve";

        postJson(player, solve, "{\"flag\":\"guess-1\"}").andExpect(status().isBadRequest());
        postJson(player, solve, "{\"flag\":\"\"}").andExpect(status().isBadRequest());
        postJson(player, solve, "{\"flag\":\"guess-2\"}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Niepoprawna flaga"));

        postJson(player, solve, "{\"flag\":\"flag\"}")
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "3600"))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().json("""
                        {"message":"Zbyt wiele błędnych odpowiedzi w tym pokoju. Spróbuj ponownie za 3600 s.","retryAfter":3600,"reason":"room-answer"}
                        """, true));

        postJson(other, solve, "{\"flag\":\"flag\"}").andExpect(status().isOk())
                .andExpect(jsonPath("$.pointsEarned").value(50));
        postJson(player, "/api/rooms/" + second + "/solve", "{\"flag\":\"flag\"}").andExpect(status().isOk());
        postJson(player, "/api/rooms/" + second + "/solve", "{\"flag\":\"flag\"}").andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Poprawna flaga! (Tryb treningowy - 0 pkt)"));
    }
}
