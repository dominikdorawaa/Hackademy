package com.hackademy.server;

import com.hackademy.server.user.Role;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.lessThanOrEqualTo;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class BugReportIntegrationTest extends PostgresIntegrationTest {

    private static final String URL = "/api/bug-reports";
    private static final String ADMIN_URL = "/api/admin/bug-reports";

    private static String arena(String description) {
        return "{\"source\":\"ARENA\",\"description\":\"" + description + "\"}";
    }

    private long reports(Account account) {
        return jdbcTemplate.queryForObject("SELECT count(*) FROM bug_reports WHERE reporter_id = ?", Long.class, account.id());
    }

    private void sentEarlier(Account account, int count, int minutesAgo) {
        for (int i = 0; i < count; i++) {
            jdbcTemplate.update("INSERT INTO bug_reports (reporter_id, source, description, created_at) VALUES (?, 'ARENA', ?, ?)",
                    account.id(), "Wcześniejsze zgłoszenie " + i, LocalDateTime.now().minusMinutes(minutesAgo + i));
        }
    }

    @Test
    void playersReportBugsFromRoomsAndTheArenaAndAdminsHandleThem() throws Exception {
        var admin = account(Role.ADMIN);
        var player = account(Role.USER);
        String title = uniqueTitle("Bug room");
        long room = createRoom(admin, title, "CTF");
        long task = jdbcTemplate.queryForObject("INSERT INTO room_tasks (room_id, title, content, sort_order) VALUES (?, 'Rozgrzewka', 'c', 0) RETURNING id",
                Long.class, room);

        postJson(player, URL, """
                {"source":"ROOM","roomId":%d,"taskId":%d,"pagePath":"/rooms/%d","description":"  Flaga nie przechodzi mimo poprawnej odpowiedzi.  "}
                """.formatted(room, task, room))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.message").value("Dziękujemy! Zgłoszenie trafiło do zespołu."));
        postJson(player, URL, """
                {"source":"ARENA","gameId":"7f0c2d1e-0000-4000-8000-000000000001","pagePath":"/arena/battle/7f0c2d1e-0000-4000-8000-000000000001","description":"Pytanie zniknęło w trakcie rundy."}
                """).andExpect(status().isCreated());

        getAs(admin, ADMIN_URL + "?status=open")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].reporterUsername").value(player.username()))
                .andExpect(jsonPath("$.items[0].source").value("ARENA"))
                .andExpect(jsonPath("$.items[0].gameId").value("7f0c2d1e-0000-4000-8000-000000000001"))
                .andExpect(jsonPath("$.items[0].roomId").value(nullValue()))
                .andExpect(jsonPath("$.items[1].source").value("ROOM"))
                .andExpect(jsonPath("$.items[1].roomId").value(room))
                .andExpect(jsonPath("$.items[1].roomTitle").value(title))
                .andExpect(jsonPath("$.items[1].taskId").value(task))
                .andExpect(jsonPath("$.items[1].taskTitle").value("Rozgrzewka"))
                .andExpect(jsonPath("$.items[1].pagePath").value("/rooms/" + room))
                .andExpect(jsonPath("$.items[1].description").value("Flaga nie przechodzi mimo poprawnej odpowiedzi."))
                .andExpect(jsonPath("$.items[1].status").value("OPEN"))
                .andExpect(jsonPath("$.items[1].createdAt").value(notNullValue()))
                .andExpect(jsonPath("$.items[1].resolvedAt").value(nullValue()));

        long id = jdbcTemplate.queryForObject("SELECT id FROM bug_reports WHERE reporter_id = ? AND source = 'ROOM'", Long.class, player.id());
        putJson(admin, ADMIN_URL + "/" + id + "/status", "{\"status\":\"RESOLVED\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RESOLVED"))
                .andExpect(jsonPath("$.roomTitle").value(title))
                .andExpect(jsonPath("$.resolvedAt").value(notNullValue()));
        getAs(admin, ADMIN_URL + "?status=RESOLVED").andExpect(jsonPath("$.items[0].id").value(id));
        getAs(admin, ADMIN_URL + "?status=OPEN").andExpect(jsonPath("$.items[0].source").value("ARENA"));
        putJson(admin, ADMIN_URL + "/" + id + "/status", "{\"status\":\"OPEN\"}")
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andExpect(jsonPath("$.resolvedAt").value(nullValue()));
        putJson(admin, ADMIN_URL + "/" + id + "/status", "{\"status\":\"OPEN\"}").andExpect(jsonPath("$.status").value("OPEN"));
        putJson(admin, ADMIN_URL + "/" + id + "/status", "{\"status\":\"CLOSED\"}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Nieznany status zgłoszenia: CLOSED"));
        getAs(admin, ADMIN_URL + "?status=CLOSED").andExpect(status().isBadRequest());
        putJson(admin, ADMIN_URL + "/0/status", "{\"status\":\"OPEN\"}").andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Nie znaleziono zgłoszenia."));

        var expert = account(Role.EXPERT);
        putJson(expert, ADMIN_URL + "/" + id + "/status", "{\"status\":\"RESOLVED\"}").andExpect(status().isForbidden());
        mockMvc.perform(delete(ADMIN_URL + "/" + id).header("Authorization", "Bearer " + player.token())).andExpect(status().isForbidden());
        mockMvc.perform(delete(ADMIN_URL + "/" + id).header("Authorization", "Bearer " + admin.token())).andExpect(status().isNoContent());
        mockMvc.perform(delete(ADMIN_URL + "/" + id).header("Authorization", "Bearer " + admin.token())).andExpect(status().isNotFound());
        assertEquals(1, reports(player));
    }

    @Test
    void savesLabContextAndReturnsItToAdmins() throws Exception {
        var player = account(Role.USER);
        var admin = account(Role.ADMIN);
        String lab = """
                {"source":"LAB","lessonId":"history","pagePath":"/learn/ukos","description":"Terminal nie reaguje na polecenie history."}
                """;
        postJson(player, URL, lab).andExpect(status().isCreated());
        assertEquals("history", jdbcTemplate.queryForObject("SELECT lesson_id FROM bug_reports WHERE reporter_id = ?", String.class, player.id()));
        getAs(admin, ADMIN_URL)
                .andExpect(jsonPath("$.items[0].source").value("LAB"))
                .andExpect(jsonPath("$.items[0].lessonId").value("history"))
                .andExpect(jsonPath("$.items[0].pagePath").value("/learn/ukos"))
                .andExpect(jsonPath("$.items[0].roomId").value(nullValue()))
                .andExpect(jsonPath("$.items[0].taskId").value(nullValue()))
                .andExpect(jsonPath("$.items[0].gameId").value(nullValue()));
        long id = jdbcTemplate.queryForObject("SELECT id FROM bug_reports WHERE reporter_id = ?", Long.class, player.id());
        putJson(admin, ADMIN_URL + "/" + id + "/status", "{\"status\":\"RESOLVED\"}")
                .andExpect(jsonPath("$.lessonId").value("history"));
        postJson(player, URL, lab).andExpect(status().isConflict());
        sentEarlier(player, 4, 5);
        postJson(player, URL, """
                {"source":"LAB","lessonId":"pwd","description":"Inny problem w terminalu."}
                """).andExpect(status().isTooManyRequests()).andExpect(header().exists("Retry-After"));
    }

    @Test
    void rejectsLabReportsWithUnknownStepsOrMixedContext() throws Exception {
        var player = account(Role.USER);
        for (String lesson : List.of("null", "\"\"", "\"unknown-step\"", "\"" + "a".repeat(65) + "\"")) {
            postJson(player, URL, """
                    {"source":"LAB","lessonId":%s,"description":"Problem w terminalu."}
                    """.formatted(lesson)).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("Nieprawidłowy krok laboratorium."));
        }
        for (String context : List.of("\"roomId\":1", "\"taskId\":1", "\"gameId\":\"game\"")) {
            postJson(player, URL, """
                    {"source":"LAB","lessonId":"pwd",%s,"description":"Problem w terminalu."}
                    """.formatted(context)).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("Zgłoszenie z laboratorium nie może wskazywać pokoju, zadania ani meczu."));
        }
        for (String path : List.of("//evil.example/learn/ukos", "/learn/ukos/", "/learn/ukos?token=secret", "/arena", "/rooms/1")) {
            postJson(player, URL, """
                    {"source":"LAB","lessonId":"pwd","pagePath":"%s","description":"Problem w terminalu."}
                    """.formatted(path)).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("Nieprawidłowy adres strony."));
        }
        for (String source : List.of("ROOM", "ARENA")) {
            postJson(player, URL, """
                    {"source":"%s","lessonId":"pwd","description":"Krok poza laboratorium."}
                    """.formatted(source)).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("Nieprawidłowy krok laboratorium."));
        }
        assertEquals(0, reports(player));
    }

    @Test
    void rejectsInvalidReportsWithoutSavingThem() throws Exception {
        var admin = account(Role.ADMIN);
        var player = account(Role.USER);
        long room = createRoom(admin, uniqueTitle("Valid room"), "CTF");
        long other = createRoom(admin, uniqueTitle("Other room"), "CTF");
        long foreignTask = jdbcTemplate.queryForObject("INSERT INTO room_tasks (room_id, title, content, sort_order) VALUES (?, 't', 'c', 0) RETURNING id",
                Long.class, other);

        postJson(player, URL, arena("  123456789  ")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Opisz problem w co najmniej 10 znakach."));
        postJson(player, URL, arena("\uD83D\uDC1B".repeat(5))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Opisz problem w co najmniej 10 znakach."));
        postJson(player, URL, arena("a".repeat(2001))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Opis może mieć najwyżej 2000 znaków."));
        postJson(player, URL, "{\"description\":\"Opis bez miejsca problemu\"}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Wskaż, gdzie wystąpił problem."));
        postJson(player, URL, "{\"source\":\"ROOM\",\"description\":\"Brak pokoju w zgłoszeniu\"}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Nie znaleziono pokoju, którego dotyczy zgłoszenie."));
        postJson(player, URL, "{\"source\":\"ROOM\",\"roomId\":0,\"description\":\"Pokój, którego nie ma\"}").andExpect(status().isBadRequest());
        postJson(player, URL, "{\"source\":\"ROOM\",\"roomId\":%d,\"taskId\":%d,\"description\":\"Zadanie z innego pokoju\"}".formatted(room, foreignTask))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("To zadanie nie należy do wskazanego pokoju."));
        postJson(player, URL, "{\"source\":\"ROOM\",\"roomId\":%d,\"gameId\":\"abc\",\"description\":\"Pokój z meczem\"}".formatted(room))
                .andExpect(status().isBadRequest());
        postJson(player, URL, "{\"source\":\"ARENA\",\"roomId\":%d,\"description\":\"Arena z pokojem\"}".formatted(room))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Zgłoszenie z areny nie może wskazywać pokoju."));
        postJson(player, URL, "{\"source\":\"ARENA\",\"taskId\":%d,\"description\":\"Arena z zadaniem\"}".formatted(foreignTask))
                .andExpect(status().isBadRequest());
        postJson(player, URL, "{\"source\":\"ARENA\",\"gameId\":\"../admin\",\"description\":\"Dziwny identyfikator meczu\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Nieprawidłowy identyfikator meczu."));
        postJson(player, URL, "{\"source\":\"ARENA\",\"pagePath\":\"javascript:alert(1)\",\"description\":\"Dziwny adres strony\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Nieprawidłowy adres strony."));
        for (String path : List.of("//evil.example/login", "/arena//evil.example", "/arena/battle/../admin", "/admin/bug-reports", "/rooms/" + room)) {
            postJson(player, URL, "{\"source\":\"ARENA\",\"pagePath\":\"%s\",\"description\":\"Adres spoza areny\"}".formatted(path))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("Nieprawidłowy adres strony."));
        }
        for (String path : List.of("//evil.example/login", "/rooms/" + other, "/rooms/" + room + "/x", "/arena")) {
            postJson(player, URL, "{\"source\":\"ROOM\",\"roomId\":%d,\"pagePath\":\"%s\",\"description\":\"Adres spoza pokoju\"}".formatted(room, path))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("Nieprawidłowy adres strony."));
        }
        postJson(player, URL, "{\"source\":\"CHAT\",\"description\":\"Nieznane miejsce\"}").andExpect(status().isBadRequest());
        mockMvc.perform(post(URL).contentType("application/json").content(arena("Bez zalogowania się")))
                .andExpect(status().isUnauthorized());
        assertEquals(0, reports(player));

        postJson(player, URL, arena("\uD83D\uDC1B".repeat(2000))).andExpect(status().isCreated());
        postJson(player, URL, "{\"source\":\"ARENA\",\"pagePath\":\"\",\"description\":\"Pusty adres \\u0000strony\"}").andExpect(status().isCreated());
        postJson(player, URL, "{\"source\":\"ARENA\",\"pagePath\":\"/arena\",\"description\":\"Zgłoszenie z lobby areny\"}").andExpect(status().isCreated());
        assertEquals(2000, jdbcTemplate.queryForObject("SELECT char_length(description) FROM bug_reports WHERE reporter_id = ? AND description LIKE '%\uD83D\uDC1B'",
                Integer.class, player.id()));
        assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM bug_reports WHERE reporter_id = ? AND description = 'Pusty adres strony' AND page_path IS NULL",
                Integer.class, player.id()));
    }

    @Test
    void ignoresTheSameReportSentAgainWithinADay() throws Exception {
        var player = account(Role.USER);
        jdbcTemplate.update("INSERT INTO bug_reports (reporter_id, source, description, created_at) VALUES (?, 'ARENA', 'Stare zgłoszenie z przedwczoraj', ?)",
                player.id(), LocalDateTime.now().minusHours(25));

        postJson(player, URL, arena("Stare zgłoszenie z przedwczoraj")).andExpect(status().isCreated());
        postJson(player, URL, arena("  Stare zgłoszenie z przedwczoraj ")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("To zgłoszenie już do nas trafiło. Nie musisz wysyłać go ponownie."));
        postJson(account(Role.USER), URL, arena("Stare zgłoszenie z przedwczoraj")).andExpect(status().isCreated());
        postJson(player, URL, arena("Zupełnie inny problem")).andExpect(status().isCreated());
        assertEquals(3, reports(player));
    }

    @Test
    void stopsTheSixthReportWithinAnHourAndTellsWhenTheNextIsPossible() throws Exception {
        var player = account(Role.USER);
        sentEarlier(player, 5, 10);

        postJson(player, URL, arena("Szóste zgłoszenie w godzinie")).andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.retryAfter").value(allOf(greaterThan(2700), lessThanOrEqualTo(2760))))
                .andExpect(jsonPath("$.message").value("Wysłano już dużo zgłoszeń. Kolejne możesz wysłać za 46 min."));
        assertEquals(5, reports(player));

        var rested = account(Role.USER);
        sentEarlier(rested, 5, 61);
        postJson(rested, URL, arena("Po godzinie przerwy")).andExpect(status().isCreated());
    }

    @Test
    void stopsTheTwentyFirstReportWithinADay() throws Exception {
        var player = account(Role.USER);
        for (int i = 0; i < 20; i++) {
            jdbcTemplate.update("INSERT INTO bug_reports (reporter_id, source, description, created_at) VALUES (?, 'ARENA', ?, ?)",
                    player.id(), "Zgłoszenie z dnia " + i, LocalDateTime.now().minusHours(2).minusMinutes(i * 60L));
        }

        MvcResult refused = postJson(player, URL, arena("Dwudzieste pierwsze zgłoszenie")).andExpect(status().isTooManyRequests()).andReturn();
        long retryAfter = Long.parseLong(refused.getResponse().getHeader("Retry-After"));
        assertTrue(retryAfter > 2 * 3600 && retryAfter <= 3 * 3600, "retry after " + retryAfter);
        assertEquals(20, reports(player));
    }

    @Test
    void concurrentReportsCannotOvershootTheHourlyLimit() throws Exception {
        var player = account(Role.USER);
        sentEarlier(player, 4, 1);
        var executor = Executors.newFixedThreadPool(4);
        var start = new CountDownLatch(1);
        try {
            List<Future<Integer>> results = new ArrayList<>();
            for (int i = 0; i < 4; i++) {
                String body = arena("Równoległe zgłoszenie " + i);
                Callable<Integer> send = () -> {
                    start.await();
                    return postJson(player, URL, body).andReturn().getResponse().getStatus();
                };
                results.add(executor.submit(send));
            }
            start.countDown();
            List<Integer> statuses = new ArrayList<>();
            for (var result : results) statuses.add(result.get(30, TimeUnit.SECONDS));
            assertEquals(1, statuses.stream().filter(code -> code == 201).count(), statuses.toString());
            assertEquals(3, statuses.stream().filter(code -> code == 429).count(), statuses.toString());
        } finally {
            executor.shutdownNow();
        }
        assertEquals(5, reports(player));
    }
}
