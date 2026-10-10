package com.hackademy.server;

import com.hackademy.server.user.Role;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class RoomTasksIntegrationTest extends PostgresIntegrationTest {
    @Test
    void completesReadingTasksAndAwardsPointsOnce() throws Exception {
        var admin = account(Role.ADMIN);
        var user = account(Role.USER);
        long room = createRoom(admin, uniqueTitle("Reading"), "PATH");
        var saved = putTaskJson(admin, "/api/admin/rooms/" + room + "/tasks", task(null, "Lektura", null, null))
                .andExpect(status().isOk()).andReturn();
        long reading = ((Number) JsonPath.read(saved.getResponse().getContentAsString(), "$.tasks[0].id")).longValue();
        postJson(user, "/api/rooms/" + room + "/tasks/complete", "{}")
                .andExpect(status().isBadRequest());
        postJson(user, "/api/rooms/" + room + "/tasks/" + reading + "/solve", "{\"answer\":\"\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pointsEarned").value(50));
        getAs(user, "/api/rooms/" + room)
                .andExpect(jsonPath("$.tasks[0].completed").value(true))
                .andExpect(jsonPath("$.solved").value(true));
        postJson(user, "/api/rooms/" + room + "/tasks/complete", "{}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pointsEarned").value(0));
        assertEquals(50, userRepository.findById(user.id()).orElseThrow().getPoints());
    }

    @Test
    void canFinishAfterAnUncompletedTaskIsDeletedButCannotBypassRemainingTasks() throws Exception {
        var admin = account(Role.ADMIN);
        var user = account(Role.USER);
        var otherUser = account(Role.USER);
        long room = createRoom(admin, uniqueTitle("Removed task"), "PATH");
        var created = putTaskJson(admin, "/api/admin/rooms/" + room + "/tasks", "{\"tasks\":["
                + taskJson(null, "A", "q", "a") + "," + taskJson(null, "B", "q", "b") + "]}")
                .andExpect(status().isOk()).andReturn();
        long first = ((Number) JsonPath.read(created.getResponse().getContentAsString(), "$.tasks[0].id")).longValue();
        postJson(user, "/api/rooms/" + room + "/tasks/" + first + "/solve", "{\"answer\":\"a\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pointsEarned").value(0));
        postJson(user, "/api/rooms/" + room + "/tasks/complete", "{}")
                .andExpect(status().isBadRequest());
        putTaskJson(admin, "/api/admin/rooms/" + room + "/tasks", task(first, "A", "q", "a"))
                .andExpect(status().isOk());
        getAs(user, "/api/rooms/" + room)
                .andExpect(jsonPath("$.tasks[0].completed").value(true))
                .andExpect(jsonPath("$.solved").value(false));
        postJson(otherUser, "/api/rooms/" + room + "/tasks/complete", "{}")
                .andExpect(status().isBadRequest());
        postJson(user, "/api/rooms/" + room + "/tasks/complete", "{}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pointsEarned").value(50));
        postJson(user, "/api/rooms/" + room + "/tasks/complete", "{}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pointsEarned").value(0));
        getAs(user, "/api/rooms/" + room)
                .andExpect(jsonPath("$.solved").value(true))
                .andExpect(jsonPath("$.solutionsCount").value(1));
        assertEquals(50, userRepository.findById(user.id()).orElseThrow().getPoints());

        long empty = createRoom(admin, uniqueTitle("Empty tasks"), "PATH");
        postJson(user, "/api/rooms/" + empty + "/tasks/complete", "{}")
                .andExpect(status().isBadRequest());
    }

    @Test
    void editsTasksAndKeepsProgressInUnchangedTasks() throws Exception {
        var admin = account(Role.ADMIN);
        var user = account(Role.USER);
        long room = createRoom(admin, uniqueTitle("Tasks"), "PATH");

        var created = putTaskJson(admin, "/api/admin/rooms/" + room + "/tasks", """
                {"tasks":[
                  {"id":null,"title":" Rekonesans ","content":"Przeczytaj","question":"Port?","answer":" 22 "},
                  {"id":null,"title":"Teoria","content":"Tylko lektura","question":"  ","answer":""}
                ]}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tasks[0].title").value("Rekonesans"))
                .andExpect(jsonPath("$.tasks[0].answer").value("22"))
                .andExpect(jsonPath("$.tasks[1].question").value(nullValue()))
                .andExpect(jsonPath("$.tasks[1].answer").value(nullValue()))
                .andReturn();
        List<Number> ids = JsonPath.read(created.getResponse().getContentAsString(), "$.tasks[*].id");
        long recon = ids.get(0).longValue();
        long theory = ids.get(1).longValue();

        postJson(user, "/api/rooms/" + room + "/tasks/" + recon + "/solve", "{\"answer\":\"22\"}")
                .andExpect(status().isOk());

        putTaskJson(admin, "/api/admin/rooms/" + room + "/tasks", """
                {"tasks":[
                  {"id":%d,"title":"Teoria 2","content":"Nowa treść","question":null,"answer":null},
                  {"id":%d,"title":"Rekonesans","content":"Przeczytaj","question":"Port?","answer":"22"},
                  {"id":null,"title":"Eksploitacja","content":"Zdobądź dostęp","question":"Flaga?","answer":"flag"}
                ]}
                """.formatted(theory, recon))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tasks[0].id").value(theory))
                .andExpect(jsonPath("$.tasks[1].id").value(recon))
                .andExpect(jsonPath("$.tasks[2].title").value("Eksploitacja"));

        getAs(user, "/api/rooms/" + room)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tasks.length()").value(3))
                .andExpect(jsonPath("$.tasks[0].title").value("Teoria 2"))
                .andExpect(jsonPath("$.tasks[0].completed").value(false))
                .andExpect(jsonPath("$.tasks[1].id").value(recon))
                .andExpect(jsonPath("$.tasks[1].completed").value(true))
                .andExpect(jsonPath("$.tasks[2].completed").value(false));

        getAs(admin, "/api/admin/rooms/" + room + "/tasks")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tasks.length()").value(3))
                .andExpect(jsonPath("$.tasks[1].answer").value("22"));

        putTaskJson(admin, "/api/admin/rooms/" + room + "/tasks", """
                {"tasks":[{"id":%d,"title":"Teoria 2","content":"Nowa treść","question":null,"answer":null}]}
                """.formatted(theory))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tasks.length()").value(1));
        assertEquals(0, jdbcTemplate.queryForObject(
                "SELECT count(*) FROM user_completed_tasks WHERE task_id = ?", Integer.class, recon));
        assertEquals(1, jdbcTemplate.queryForObject(
                "SELECT count(*) FROM room_tasks WHERE room_id = ?", Integer.class, room));
    }

    @Test
    void validatesTasksAndRoles() throws Exception {
        var admin = account(Role.ADMIN);
        var expert = account(Role.EXPERT);
        var user = account(Role.USER);
        long room = createRoom(admin, uniqueTitle("Validation"), "PATH");
        long otherRoom = createRoom(admin, uniqueTitle("Other"), "PATH");
        long ctf = createRoom(admin, uniqueTitle("Ctf tasks"), "CTF");

        var other = putTaskJson(admin, "/api/admin/rooms/" + otherRoom + "/tasks", task(null, "Obce", "q", "a"))
                .andExpect(status().isOk())
                .andReturn();
        long foreignTask = ((Number) JsonPath.read(other.getResponse().getContentAsString(), "$.tasks[0].id")).longValue();

        putTaskJson(admin, "/api/admin/rooms/" + room + "/tasks", task(null, "Bez odpowiedzi", "Pytanie?", null))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("podaj odpowiedź")));
        putTaskJson(admin, "/api/admin/rooms/" + room + "/tasks", task(null, "Bez pytania", null, "x"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("wymaga pytania")));
        putTaskJson(admin, "/api/admin/rooms/" + room + "/tasks", task(foreignTask, "Obce", "q", "a"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("nie należy do tego pokoju")));
        putTaskJson(admin, "/api/admin/rooms/" + ctf + "/tasks", task(null, "CTF", "q", "a"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("tylko do pokoi ścieżek")));
        putTaskJson(admin, "/api/admin/rooms/" + room + "/tasks", """
                {"tasks":[{"id":null,"title":"","content":"c","question":null,"answer":null}]}
                """)
                .andExpect(status().isBadRequest());
        putTaskJson(admin, "/api/admin/rooms/" + room + "/tasks", "{}")
                .andExpect(status().isBadRequest());

        var saved = putTaskJson(expert, "/api/admin/rooms/" + room + "/tasks", task(null, "Ekspert", "q", "a"))
                .andExpect(status().isOk())
                .andReturn();
        long expertTask = ((Number) JsonPath.read(saved.getResponse().getContentAsString(), "$.tasks[0].id")).longValue();
        putTaskJson(admin, "/api/admin/rooms/" + room + "/tasks", """
                {"tasks":[%s,%s]}
                """.formatted(taskJson(expertTask, "A", "q", "a"), taskJson(expertTask, "B", "q", "a")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("więcej niż raz")));
        putTaskJson(user, "/api/admin/rooms/" + room + "/tasks", task(null, "User", "q", "a"))
                .andExpect(status().isForbidden());
        getAs(user, "/api/admin/rooms/" + room + "/tasks")
                .andExpect(status().isForbidden());

        assertEquals(List.of("Ekspert"), jdbcTemplate.queryForList(
                "SELECT title FROM room_tasks WHERE room_id = ? ORDER BY sort_order", String.class, room));
    }

    @Test
    void rejectsStaleTaskDraftsWithoutDeletingNewTasksOrPlayerProgress() throws Exception {
        var admin = account(Role.ADMIN);
        var user = account(Role.USER);
        long room = createRoom(admin, uniqueTitle("Stale task draft"), "PATH");
        String url = "/api/admin/rooms/" + room + "/tasks";
        var initial = putJson(admin, url, "{\"revision\":0,\"tasks\":[" + taskJson(null, "A", "q", "a") + "]}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(1)).andReturn();
        long first = ((Number) JsonPath.read(initial.getResponse().getContentAsString(), "$.tasks[0].id")).longValue();
        String staleTasks = "\"tasks\":[" + taskJson(first, "A", "q", "a") + "]}";
        var newer = putJson(admin, url, "{\"revision\":1,\"tasks\":["
                + taskJson(first, "A", "q", "a") + "," + taskJson(null, "B", "q", "b") + "]}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(2)).andReturn();
        long added = ((Number) JsonPath.read(newer.getResponse().getContentAsString(), "$.tasks[1].id")).longValue();
        postJson(user, "/api/rooms/" + room + "/tasks/" + added + "/solve", "{\"answer\":\"b\"}")
                .andExpect(status().isOk());
        putJson(admin, url, "{\"revision\":1," + staleTasks).andExpect(status().isConflict());
        getAs(admin, url).andExpect(jsonPath("$.revision").value(2))
                .andExpect(jsonPath("$.tasks.length()").value(2)).andExpect(jsonPath("$.tasks[1].id").value(added));
        assertEquals(1, jdbcTemplate.queryForObject(
                "SELECT count(*) FROM user_completed_tasks WHERE user_id = ? AND task_id = ?", Integer.class, user.id(), added));
        putJson(admin, url, "{" + staleTasks).andExpect(status().isBadRequest());
        putJson(admin, url, "{\"revision\":2," + staleTasks)
                .andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(3))
                .andExpect(jsonPath("$.tasks.length()").value(1));
    }

    private org.springframework.test.web.servlet.ResultActions putTaskJson(Account account, String url, String body) throws Exception {
        long roomId = Long.parseLong(url.split("/")[4]);
        long revision = jdbcTemplate.queryForObject("SELECT tasks_revision FROM rooms WHERE id = ?", Long.class, roomId);
        return putJson(account, url, "{\"revision\":" + revision + "," + body.substring(1));
    }

    private String task(Long id, String title, String question, String answer) {
        return "{\"tasks\":[" + taskJson(id, title, question, answer) + "]}";
    }

    private String taskJson(Long id, String title, String question, String answer) {
        return """
                {"id":%s,"title":"%s","content":"Treść","question":%s,"answer":%s}
                """.formatted(id, title, quoted(question), quoted(answer));
    }

    private String quoted(String value) {
        return value == null ? "null" : "\"" + value + "\"";
    }
}
