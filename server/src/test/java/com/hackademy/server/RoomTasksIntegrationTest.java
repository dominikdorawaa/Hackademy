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
    void editsTasksAndKeepsProgressInUnchangedTasks() throws Exception {
        var admin = account(Role.ADMIN);
        var user = account(Role.USER);
        long room = createRoom(admin, uniqueTitle("Tasks"), "PATH");

        var created = putJson(admin, "/api/admin/rooms/" + room + "/tasks", """
                {"tasks":[
                  {"id":null,"title":" Rekonesans ","content":"Przeczytaj","question":"Port?","answer":" 22 "},
                  {"id":null,"title":"Teoria","content":"Tylko lektura","question":"  ","answer":""}
                ]}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Rekonesans"))
                .andExpect(jsonPath("$[0].answer").value("22"))
                .andExpect(jsonPath("$[1].question").value(nullValue()))
                .andExpect(jsonPath("$[1].answer").value(nullValue()))
                .andReturn();
        List<Number> ids = JsonPath.read(created.getResponse().getContentAsString(), "$[*].id");
        long recon = ids.get(0).longValue();
        long theory = ids.get(1).longValue();

        postJson(user, "/api/rooms/" + room + "/tasks/" + recon + "/solve", "{\"answer\":\"22\"}")
                .andExpect(status().isOk());

        putJson(admin, "/api/admin/rooms/" + room + "/tasks", """
                {"tasks":[
                  {"id":%d,"title":"Teoria 2","content":"Nowa treść","question":null,"answer":null},
                  {"id":%d,"title":"Rekonesans","content":"Przeczytaj","question":"Port?","answer":"22"},
                  {"id":null,"title":"Eksploitacja","content":"Zdobądź dostęp","question":"Flaga?","answer":"flag"}
                ]}
                """.formatted(theory, recon))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(theory))
                .andExpect(jsonPath("$[1].id").value(recon))
                .andExpect(jsonPath("$[2].title").value("Eksploitacja"));

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
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[1].answer").value("22"));

        putJson(admin, "/api/admin/rooms/" + room + "/tasks", """
                {"tasks":[{"id":%d,"title":"Teoria 2","content":"Nowa treść","question":null,"answer":null}]}
                """.formatted(theory))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
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

        var other = putJson(admin, "/api/admin/rooms/" + otherRoom + "/tasks", task(null, "Obce", "q", "a"))
                .andExpect(status().isOk())
                .andReturn();
        long foreignTask = ((Number) JsonPath.read(other.getResponse().getContentAsString(), "$[0].id")).longValue();

        putJson(admin, "/api/admin/rooms/" + room + "/tasks", task(null, "Bez odpowiedzi", "Pytanie?", null))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("podaj odpowiedź")));
        putJson(admin, "/api/admin/rooms/" + room + "/tasks", task(null, "Bez pytania", null, "x"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("wymaga pytania")));
        putJson(admin, "/api/admin/rooms/" + room + "/tasks", task(foreignTask, "Obce", "q", "a"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("nie należy do tego pokoju")));
        putJson(admin, "/api/admin/rooms/" + ctf + "/tasks", task(null, "CTF", "q", "a"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("tylko do pokoi ścieżek")));
        putJson(admin, "/api/admin/rooms/" + room + "/tasks", """
                {"tasks":[{"id":null,"title":"","content":"c","question":null,"answer":null}]}
                """)
                .andExpect(status().isBadRequest());
        putJson(admin, "/api/admin/rooms/" + room + "/tasks", "{}")
                .andExpect(status().isBadRequest());

        var saved = putJson(expert, "/api/admin/rooms/" + room + "/tasks", task(null, "Ekspert", "q", "a"))
                .andExpect(status().isOk())
                .andReturn();
        long expertTask = ((Number) JsonPath.read(saved.getResponse().getContentAsString(), "$[0].id")).longValue();
        putJson(admin, "/api/admin/rooms/" + room + "/tasks", """
                {"tasks":[%s,%s]}
                """.formatted(taskJson(expertTask, "A", "q", "a"), taskJson(expertTask, "B", "q", "a")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("więcej niż raz")));
        putJson(user, "/api/admin/rooms/" + room + "/tasks", task(null, "User", "q", "a"))
                .andExpect(status().isForbidden());
        getAs(user, "/api/admin/rooms/" + room + "/tasks")
                .andExpect(status().isForbidden());

        assertEquals(List.of("Ekspert"), jdbcTemplate.queryForList(
                "SELECT title FROM room_tasks WHERE room_id = ? ORDER BY sort_order", String.class, room));
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
