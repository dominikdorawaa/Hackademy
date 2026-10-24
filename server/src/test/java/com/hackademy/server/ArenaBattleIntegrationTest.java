package com.hackademy.server;

import com.hackademy.server.arena.ArenaService;
import com.hackademy.server.user.Role;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.LongSupplier;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ArenaBattleIntegrationTest extends PostgresIntegrationTest {
    @Autowired
    private ArenaService arena;

    @Test
    void seedsEnoughQuestionsForAFullBattle() {
        assertEquals(42, jdbcTemplate.queryForObject("SELECT count(*) FROM arena_questions", Integer.class));
        assertEquals(0, jdbcTemplate.queryForObject(
                """
                SELECT count(*) FROM arena_questions WHERE (SELECT count(DISTINCT lower(answer))
                    FROM unnest(ARRAY[correct_answer, wrong_answer_1, wrong_answer_2, wrong_answer_3]) AS answer) <> 4
                """, Integer.class));
    }

    @Test
    void playersSeeTheQuestionWithoutTheCorrectAnswerAndAnswerOnce() throws Exception {
        var first = account(Role.USER);
        var second = account(Role.USER);
        var outsider = account(Role.USER);
        var challenge = arena.createChallenge(first.id(), first.username(), second.id(), second.username());
        String game = arena.acceptChallenge(challenge.getId(), second.id()).getId();
        String url = "/api/arena/game/" + game;

        getAs(first, url).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.round").value(1))
                .andExpect(jsonPath("$.totalRounds").value(10))
                .andExpect(jsonPath("$.question.answers", hasSize(4)))
                .andExpect(jsonPath("$.question.correctAnswer").doesNotExist())
                .andExpect(jsonPath("$.questions").doesNotExist())
                .andExpect(jsonPath("$.choices").doesNotExist())
                .andExpect(jsonPath("$.answerElapsedMillis").doesNotExist())
                .andExpect(jsonPath("$.hp['" + first.id() + "']").value(100));
        getAs(outsider, url).andExpect(status().isNotFound());

        postJson(outsider, url + "/answer", "{\"round\":1,\"answer\":1}").andExpect(status().isNotFound());
        postJson(first, url + "/answer", "{\"round\":1,\"answer\":7}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Wybierz jedną z czterech odpowiedzi."));
        postJson(first, url + "/answer", "{}").andExpect(status().isBadRequest());
        postJson(first, url + "/answer", "{\"answer\":1}").andExpect(status().isBadRequest());
        postJson(first, url + "/answer", "{\"round\":0,\"answer\":1}").andExpect(status().isBadRequest());
        postJson(first, url + "/answer", "{\"round\":2,\"answer\":1}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Ta odpowiedź dotyczy innej rundy. Odpowiedz na bieżące pytanie."));
        postJson(first, url + "/answer", "{\"round\":1,\"answer\":1}").andExpect(status().isOk());
        postJson(first, url + "/answer", "{\"round\":1,\"answer\":2}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Odpowiedź w tej rundzie została już wysłana."));
        getAs(second, url).andExpect(jsonPath("$.answeredBy[0]").value(first.id()));

        postJson(second, url + "/answer", "{\"round\":1,\"answer\":0}").andExpect(status().isOk());
        getAs(second, url).andExpect(jsonPath("$.phase").value("REVEAL"))
                .andExpect(jsonPath("$.lastRound.correctAnswer").exists())
                .andExpect(jsonPath("$.lastRound.choices['" + second.id() + "']").value(0));
        postJson(second, url + "/answer", "{\"round\":1,\"answer\":0}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Ta runda jest już zakończona."));

        postJson(second, url + "/surrender", "{}").andExpect(status().isOk());
        getAs(first, url).andExpect(jsonPath("$.status").value("FINISHED"))
                .andExpect(jsonPath("$.winnerId").value(first.id()))
                .andExpect(jsonPath("$.finishReason").value("SURRENDER"));
    }

    @Test
    void aPlayerWithNoXpJoinsTheQueue() throws Exception {
        var beginner = account(Role.USER);
        assertEquals(0, jdbcTemplate.queryForObject("SELECT points FROM users WHERE id = ?", Integer.class, beginner.id()));
        postJson(beginner, "/api/arena/join", "{}").andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Dołączono do kolejki"));
        postJson(beginner, "/api/arena/leave", "{}").andExpect(status().isOk());
    }

    @Test
    void ignoresClientTimingAndDamageAndReportsBothServerTimedHits() throws Exception {
        var first = account(Role.USER);
        var second = account(Role.USER);
        var now = new AtomicLong(10_000);
        LongSupplier clock = now::get;
        ReflectionTestUtils.invokeMethod(arena, "useClock", clock);
        try {
            var challenge = arena.createChallenge(first.id(), first.username(), second.id(), second.username());
            String game = arena.acceptChallenge(challenge.getId(), second.id()).getId();
            String url = "/api/arena/game/" + game;
            var question = arena.getGameSession(game).getQuestion();
            String answer = jdbcTemplate.queryForObject("SELECT correct_answer FROM arena_questions WHERE id = ?", String.class, question.id());
            int correct = question.answers().indexOf(answer);
            now.addAndGet(4_999);
            postJson(first, url + "/answer", "{\"round\":1,\"answer\":" + correct + ",\"elapsedMillis\":0,\"damage\":999999,\"sentAt\":0}")
                    .andExpect(status().isOk());
            now.incrementAndGet();
            postJson(second, url + "/answer", "{\"round\":1,\"answer\":" + correct + ",\"damage\":0}")
                    .andExpect(status().isOk());
            getAs(first, url).andExpect(status().isOk())
                    .andExpect(jsonPath("$.lastRound.damage['" + first.id() + "']").value(15))
                    .andExpect(jsonPath("$.lastRound.damage['" + second.id() + "']").value(16))
                    .andExpect(jsonPath("$.hp['" + first.id() + "']").value(85))
                    .andExpect(jsonPath("$.hp['" + second.id() + "']").value(84))
                    .andExpect(jsonPath("$.answerElapsedMillis").doesNotExist());
        } finally {
            LongSupplier systemClock = System::currentTimeMillis;
            ReflectionTestUtils.invokeMethod(arena, "useClock", systemClock);
        }
    }
}
