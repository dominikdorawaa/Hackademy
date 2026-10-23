package com.hackademy.server;

import com.hackademy.server.arena.ArenaService;
import com.hackademy.server.user.Role;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.ResultActions;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ArenaQuestionAdminIntegrationTest extends PostgresIntegrationTest {
    private static final String URL = "/api/admin/arena/questions";

    @Autowired
    private ArenaService arena;

    private final List<Long> created = new ArrayList<>();
    private final List<Map<String, Object>> restore = new ArrayList<>();

    @AfterEach
    void restoreTheSeededBank() {
        created.forEach(id -> jdbcTemplate.update("DELETE FROM arena_questions WHERE id = ?", id));
        restore.forEach(row -> jdbcTemplate.update("""
                UPDATE arena_questions SET content = ?, answer_a = ?, answer_b = ?, answer_c = ?, answer_d = ?,
                    correct_answer = ?, category = ?, difficulty = ? WHERE id = ?
                """, row.get("content"), row.get("answer_a"), row.get("answer_b"), row.get("answer_c"),
                row.get("answer_d"), row.get("correct_answer"), row.get("category"), row.get("difficulty"), row.get("id")));
    }

    private static String body(String content, List<String> answers, Object correct, String category, String difficulty, Long version) {
        String list = answers == null ? "null" : answers.stream().map(answer -> answer == null ? "null" : "\"" + answer + "\"")
                .reduce((left, right) -> left + "," + right).map(items -> "[" + items + "]").orElse("[]");
        return """
                {"content":%s,"answers":%s,"correctAnswer":%s,"category":%s,"difficulty":%s,"version":%s}
                """.formatted(content == null ? "null" : "\"" + content + "\"", list, correct,
                category == null ? "null" : "\"" + category + "\"", difficulty == null ? "null" : "\"" + difficulty + "\"", version);
    }

    private long create(Account admin, String content, String category, String difficulty) throws Exception {
        var result = postJson(admin, URL, body(content, List.of("Pierwsza", "Druga", "Trzecia", "Czwarta"), 2, category, difficulty, null))
                .andExpect(status().isCreated()).andReturn();
        long id = ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id")).longValue();
        created.add(id);
        return id;
    }

    private ResultActions deleteAs(Account account, long id) throws Exception {
        return mockMvc.perform(delete(URL + "/" + id).header("Authorization", "Bearer " + account.token()));
    }

    @Test
    void onlyAdministratorsManageTheBank() throws Exception {
        var admin = account(Role.ADMIN);
        long id = create(admin, "Pytanie tylko dla admina " + UUID.randomUUID(), "WEB", "EASY");
        String valid = body("Zmiana", List.of("A", "B", "C", "D"), 0, "WEB", "EASY", 0L);
        for (var role : List.of(Role.EXPERT, Role.USER)) {
            var other = account(role);
            getAs(other, URL).andExpect(status().isForbidden());
            postJson(other, URL, valid).andExpect(status().isForbidden());
            putJson(other, URL + "/" + id, valid).andExpect(status().isForbidden());
            deleteAs(other, id).andExpect(status().isForbidden());
        }
        mockMvc.perform(get(URL)).andExpect(status().isUnauthorized());
        assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM arena_questions WHERE id = ? AND content <> 'Zmiana'", Integer.class, id));
    }

    @Test
    void createsSearchesEditsAndDeletesQuestions() throws Exception {
        var admin = account(Role.ADMIN);
        String marker = UUID.randomUUID().toString().substring(0, 8);
        long first = create(admin, "Bank " + marker + " pierwsze", "LINUX", "HARD");
        long second = create(admin, "Bank " + marker + " drugie", "OGOLNE", "EASY");

        getAs(admin, URL + "?query=" + marker.toUpperCase()).andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].id").value(second))
                .andExpect(jsonPath("$.items[1].answers", hasSize(4)))
                .andExpect(jsonPath("$.items[1].correctAnswer").value(2))
                .andExpect(jsonPath("$.items[1].version").value(0));
        getAs(admin, URL + "?query=" + marker + "&category=LINUX").andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].id").value(first));
        getAs(admin, URL + "?query=" + marker + "&difficulty=EASY").andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].id").value(second));
        getAs(admin, URL + "?category=CTF").andExpect(status().isBadRequest());
        getAs(admin, URL + "?query=Czwarta&size=1").andExpect(jsonPath("$.items", hasSize(1))).andExpect(jsonPath("$.hasNext").value(true));

        putJson(admin, URL + "/" + first, body("Bank " + marker + " poprawione", List.of(" Root ", "Użytkownik", "Grupa", "Inni"), 0, "WEB", "MEDIUM", 0L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("Bank " + marker + " poprawione"))
                .andExpect(jsonPath("$.answers[0]").value("Root"))
                .andExpect(jsonPath("$.category").value("WEB"))
                .andExpect(jsonPath("$.version").value(1));
        putJson(admin, URL + "/" + first, body("Nieaktualne", List.of("A", "B", "C", "D"), 1, "WEB", "EASY", 0L))
                .andExpect(status().isConflict());
        putJson(admin, URL + "/999999999", body("Brak", List.of("A", "B", "C", "D"), 1, "WEB", "EASY", 0L))
                .andExpect(status().isNotFound());

        deleteAs(admin, second).andExpect(status().isNoContent());
        deleteAs(admin, second).andExpect(status().isNotFound());
        getAs(admin, URL + "?query=" + marker).andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].difficulty").value("MEDIUM"));
    }

    @Test
    void rejectsQuestionsTheEngineCannotPlay() throws Exception {
        var admin = account(Role.ADMIN);
        var four = List.of("A", "B", "C", "D");
        int before = jdbcTemplate.queryForObject("SELECT count(*) FROM arena_questions", Integer.class);
        postJson(admin, URL, body("  ", four, 0, "WEB", "EASY", null)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.content").value("Treść pytania jest wymagana."));
        postJson(admin, URL, body("x".repeat(501), four, 0, "WEB", "EASY", null)).andExpect(status().isBadRequest());
        postJson(admin, URL, body("Trzy odpowiedzi", List.of("A", "B", "C"), 0, "WEB", "EASY", null)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.answers").value("Podaj cztery odpowiedzi."));
        postJson(admin, URL, body("Bez odpowiedzi", null, 0, "WEB", "EASY", null)).andExpect(status().isBadRequest());
        postJson(admin, URL, body("Pusta odpowiedź", java.util.Arrays.asList("A", " ", "C", "D"), 0, "WEB", "EASY", null))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$['answers[1]']").value("Każda z czterech odpowiedzi jest wymagana."));
        postJson(admin, URL, body("Za długa odpowiedź", List.of("A", "x".repeat(201), "C", "D"), 0, "WEB", "EASY", null)).andExpect(status().isBadRequest());
        postJson(admin, URL, body("Bez wskazania", four, null, "WEB", "EASY", null)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.correctAnswer").value("Wskaż poprawną odpowiedź."));
        postJson(admin, URL, body("Piąta odpowiedź", four, 4, "WEB", "EASY", null)).andExpect(status().isBadRequest());
        postJson(admin, URL, body("Ujemna", four, -1, "WEB", "EASY", null)).andExpect(status().isBadRequest());
        postJson(admin, URL, body("Kategoria", four, 0, "CTF", "EASY", null)).andExpect(status().isBadRequest());
        postJson(admin, URL, body("Trudność", four, 0, "WEB", "INSANE", null)).andExpect(status().isBadRequest());
        postJson(admin, URL, body("Powtórka", List.of("A", "a", "C", "D"), 0, "WEB", "EASY", null)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Odpowiedzi muszą się od siebie różnić."));
        assertEquals(before, jdbcTemplate.queryForObject("SELECT count(*) FROM arena_questions", Integer.class));
    }

    @Test
    void aStartedDuelKeepsItsQuestionsWhileTheBankChanges() throws Exception {
        var admin = account(Role.ADMIN);
        var first = account(Role.USER);
        var second = account(Role.USER);
        var challenge = arena.createChallenge(first.id(), first.username(), second.id(), second.username());
        String game = "/api/arena/game/" + arena.acceptChallenge(challenge.getId(), second.id()).getId();
        var state = getAs(first, game).andReturn().getResponse().getContentAsString();
        long id = ((Number) JsonPath.read(state, "$.question.id")).longValue();
        String content = JsonPath.read(state, "$.question.content");
        List<String> answers = JsonPath.read(state, "$.question.answers");
        var original = jdbcTemplate.queryForMap("SELECT * FROM arena_questions WHERE id = ?", id);
        restore.add(original);
        int correct = ((Number) original.get("correct_answer")).intValue();
        int changed = (correct + 1) % 4;

        long version = ((Number) original.get("version")).longValue();
        putJson(admin, URL + "/" + id, body("Zmienione w trakcie walki", List.of("W", "X", "Y", "Z"), changed, "OGOLNE", "HARD", version))
                .andExpect(status().isOk());

        getAs(second, game).andExpect(jsonPath("$.question.id").value(id))
                .andExpect(jsonPath("$.question.content").value(content))
                .andExpect(jsonPath("$.question.answers[0]").value(answers.get(0)))
                .andExpect(jsonPath("$.question.correctAnswer").doesNotExist());
        postJson(first, game + "/answer", "{\"round\":1,\"answer\":" + correct + "}").andExpect(status().isOk());
        postJson(second, game + "/answer", "{\"round\":1,\"answer\":" + changed + "}").andExpect(status().isOk());
        getAs(first, game).andExpect(jsonPath("$.lastRound.content").value(content))
                .andExpect(jsonPath("$.lastRound.correctAnswer").value(correct))
                .andExpect(jsonPath("$.lastRound.damage['" + first.id() + "']").value(0))
                .andExpect(jsonPath("$.hp['" + first.id() + "']").value(100));
        getAs(admin, URL + "?query=Zmienione w trakcie walki").andExpect(jsonPath("$.items[0].id").value(id));

        long extra = create(admin, "Usuwane w trakcie walki " + UUID.randomUUID(), "WEB", "EASY");
        deleteAs(admin, extra).andExpect(status().isNoContent());
        postJson(second, game + "/surrender", "{}").andExpect(status().isOk());
        getAs(first, game).andExpect(jsonPath("$.status").value("FINISHED"));
    }
}
