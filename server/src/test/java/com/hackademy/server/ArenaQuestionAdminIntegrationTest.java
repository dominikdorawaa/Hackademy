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
                UPDATE arena_questions SET content = ?, correct_answer = ?, wrong_answer_1 = ?, wrong_answer_2 = ?,
                    wrong_answer_3 = ?, category = ?, difficulty = ? WHERE id = ?
                """, row.get("content"), row.get("correct_answer"), row.get("wrong_answer_1"), row.get("wrong_answer_2"),
                row.get("wrong_answer_3"), row.get("category"), row.get("difficulty"), row.get("id")));
    }

    private static String text(String value) {
        return value == null ? "null" : "\"" + value + "\"";
    }

    private static String body(String content, String correct, List<String> wrong, String category, String difficulty, Long version) {
        String list = wrong == null ? "null" : wrong.stream().map(ArenaQuestionAdminIntegrationTest::text)
                .reduce((left, right) -> left + "," + right).map(items -> "[" + items + "]").orElse("[]");
        return """
                {"content":%s,"correctAnswer":%s,"wrongAnswers":%s,"category":%s,"difficulty":%s,"version":%s}
                """.formatted(text(content), text(correct), list, text(category), text(difficulty), version);
    }

    private long create(Account admin, String content, String category, String difficulty) throws Exception {
        var result = postJson(admin, URL, body(content, "Trzecia", List.of("Pierwsza", "Druga", "Czwarta"), category, difficulty, null))
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
        String valid = body("Zmiana", "A", List.of("B", "C", "D"), "WEB", "EASY", 0L);
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
        long first = create(admin, "Bank " + marker + " pierwsze", "LINUX", "VERY_HARD");
        long second = create(admin, "Bank " + marker + " drugie", "OGOLNE", "EASY");

        getAs(admin, URL + "?query=" + marker.toUpperCase()).andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].id").value(second))
                .andExpect(jsonPath("$.items[1].wrongAnswers", hasSize(3)))
                .andExpect(jsonPath("$.items[1].wrongAnswers[2]").value("Czwarta"))
                .andExpect(jsonPath("$.items[1].correctAnswer").value("Trzecia"))
                .andExpect(jsonPath("$.items[1].answers").doesNotExist())
                .andExpect(jsonPath("$.items[1].version").value(0));
        getAs(admin, URL + "?query=" + marker + "&category=LINUX").andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].id").value(first));
        getAs(admin, URL + "?query=" + marker + "&difficulty=EASY").andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].id").value(second));
        getAs(admin, URL + "?query=" + marker + "&difficulty=very_hard").andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].id").value(first))
                .andExpect(jsonPath("$.items[0].difficulty").value("VERY_HARD"));
        getAs(admin, URL + "?query=" + marker + "&difficulty=HARD").andExpect(jsonPath("$.items", hasSize(0)));
        getAs(admin, URL + "?category=CTF").andExpect(status().isBadRequest());
        getAs(admin, URL + "?query=Trzecia&size=1").andExpect(jsonPath("$.items", hasSize(1))).andExpect(jsonPath("$.hasNext").value(true));
        getAs(admin, URL + "?query=Czwarta&size=1").andExpect(jsonPath("$.items", hasSize(1))).andExpect(jsonPath("$.hasNext").value(true));

        putJson(admin, URL + "/" + first, body("Bank " + marker + " poprawione", " Root ", List.of("Użytkownik ", "Grupa", "Inni"), "WEB", "VERY_EASY", 0L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("Bank " + marker + " poprawione"))
                .andExpect(jsonPath("$.correctAnswer").value("Root"))
                .andExpect(jsonPath("$.wrongAnswers[0]").value("Użytkownik"))
                .andExpect(jsonPath("$.category").value("WEB"))
                .andExpect(jsonPath("$.version").value(1));
        putJson(admin, URL + "/" + first, body("Nieaktualne", "A", List.of("B", "C", "D"), "WEB", "EASY", 0L))
                .andExpect(status().isConflict());
        putJson(admin, URL + "/999999999", body("Brak", "A", List.of("B", "C", "D"), "WEB", "EASY", 0L))
                .andExpect(status().isNotFound());

        deleteAs(admin, second).andExpect(status().isNoContent());
        deleteAs(admin, second).andExpect(status().isNotFound());
        getAs(admin, URL + "?query=" + marker).andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].difficulty").value("VERY_EASY"));
    }

    @Test
    void exposesTheMigratedQuestionsInTheAdminBank() throws Exception {
        var admin = account(Role.ADMIN);
        for (String category : List.of("WINDOWS", "BLUE_TEAM", "CHMURA")) {
            int total = category.equals("CHMURA") ? 35 : 40;
            getAs(admin, URL + "?category=" + category + "&size=100")
                    .andExpect(status().isOk()).andExpect(jsonPath("$.items", hasSize(total)))
                    .andExpect(jsonPath("$.hasNext").value(false))
                    .andExpect(jsonPath("$.items[0].correctAnswer").isNotEmpty())
                    .andExpect(jsonPath("$.items[0].wrongAnswers", hasSize(3)));
            getAs(admin, URL + "?category=" + category + "&difficulty=VERY_HARD&size=100")
                    .andExpect(status().isOk()).andExpect(jsonPath("$.items", hasSize(total / 5)));
        }
    }

    @Test
    void createsFiltersAndEditsEveryNewCategory() throws Exception {
        var admin = account(Role.ADMIN);
        String marker = UUID.randomUUID().toString();
        for (String category : List.of("WINDOWS", "BLUE_TEAM", "CHMURA")) {
            long id = create(admin, "Nowa kategoria " + category + " " + marker, category, "HARD");
            getAs(admin, URL + "?query=" + marker + "&category=" + category)
                    .andExpect(status().isOk()).andExpect(jsonPath("$.items", hasSize(1)))
                    .andExpect(jsonPath("$.items[0].id").value(id))
                    .andExpect(jsonPath("$.items[0].category").value(category));
            putJson(admin, URL + "/" + id, body("Zmiana " + marker, "A", List.of("B", "C", "D"), category, "VERY_HARD", 0L))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.category").value(category));
        }
    }

    @Test
    void rejectsQuestionsTheEngineCannotPlay() throws Exception {
        var admin = account(Role.ADMIN);
        var three = List.of("B", "C", "D");
        int before = jdbcTemplate.queryForObject("SELECT count(*) FROM arena_questions", Integer.class);
        postJson(admin, URL, body("  ", "A", three, "WEB", "EASY", null)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.content").value("Treść pytania jest wymagana."));
        postJson(admin, URL, body("x".repeat(501), "A", three, "WEB", "EASY", null)).andExpect(status().isBadRequest());
        postJson(admin, URL, body("Bez poprawnej", null, three, "WEB", "EASY", null)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.correctAnswer").value("Poprawna odpowiedź jest wymagana."));
        postJson(admin, URL, body("Pusta poprawna", " ", three, "WEB", "EASY", null)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.correctAnswer").value("Poprawna odpowiedź jest wymagana."));
        postJson(admin, URL, body("Za długa poprawna", "x".repeat(201), three, "WEB", "EASY", null)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.correctAnswer").value("Odpowiedź może mieć najwyżej 200 znaków."));
        postJson(admin, URL, body("Dwie błędne", "A", List.of("B", "C"), "WEB", "EASY", null)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.wrongAnswers").value("Podaj trzy błędne odpowiedzi."));
        postJson(admin, URL, body("Cztery błędne", "A", List.of("B", "C", "D", "E"), "WEB", "EASY", null)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.wrongAnswers").value("Podaj trzy błędne odpowiedzi."));
        postJson(admin, URL, body("Bez błędnych", "A", null, "WEB", "EASY", null)).andExpect(status().isBadRequest());
        postJson(admin, URL, body("Pusta błędna", "A", java.util.Arrays.asList("B", " ", "D"), "WEB", "EASY", null))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$['wrongAnswers[1]']").value("Każda z trzech błędnych odpowiedzi jest wymagana."));
        postJson(admin, URL, body("Za długa błędna", "A", List.of("B", "x".repeat(201), "D"), "WEB", "EASY", null)).andExpect(status().isBadRequest());
        postJson(admin, URL, body("Kategoria", "A", three, "CTF", "EASY", null)).andExpect(status().isBadRequest());
        postJson(admin, URL, body("Trudność", "A", three, "WEB", "INSANE", null)).andExpect(status().isBadRequest());
        postJson(admin, URL, body("Powtórka", "A", List.of("a", "C", "D"), "WEB", "EASY", null)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Odpowiedzi muszą się od siebie różnić."));
        postJson(admin, URL, body("Powtórka błędnych", "A", List.of("B", " b ", "D"), "WEB", "EASY", null)).andExpect(status().isBadRequest())
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
        int correct = answers.indexOf((String) original.get("correct_answer"));
        int changed = (correct + 1) % 4;

        long version = ((Number) original.get("version")).longValue();
        String suffix = " " + UUID.randomUUID();
        List<String> replaced = List.of("X" + suffix, "Y" + suffix, "Z" + suffix);
        putJson(admin, URL + "/" + id, body("Zmienione w trakcie walki", answers.get(changed), replaced, "OGOLNE", "HARD", version))
                .andExpect(status().isOk());

        getAs(second, game).andExpect(jsonPath("$.question.id").value(id))
                .andExpect(jsonPath("$.question.content").value(content))
                .andExpect(jsonPath("$.question.answers").value(answers))
                .andExpect(jsonPath("$.question.correctAnswer").doesNotExist());
        postJson(first, game + "/answer", "{\"round\":1,\"answer\":" + correct + "}").andExpect(status().isOk());
        postJson(second, game + "/answer", "{\"round\":1,\"answer\":" + changed + "}").andExpect(status().isOk());
        getAs(first, game).andExpect(jsonPath("$.lastRound.content").value(content))
                .andExpect(jsonPath("$.lastRound.answers").value(answers))
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
