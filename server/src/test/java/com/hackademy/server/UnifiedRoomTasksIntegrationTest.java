package com.hackademy.server;

import tools.jackson.databind.ObjectMapper;
import com.hackademy.server.user.Role;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class UnifiedRoomTasksIntegrationTest extends PostgresIntegrationTest {
    private final ObjectMapper mapper = new ObjectMapper();

    private Map<String, Object> room(String type, List<Map<String, Object>> tasks) {
        var room = new LinkedHashMap<String, Object>();
        room.put("title", uniqueTitle(type + " room")); room.put("description", "Opis"); room.put("shortDescription", "");
        room.put("difficulty", "MEDIUM"); room.put("category", "Web"); room.put("points", 20);
        room.put("requiresVpn", false); room.put("roomType", type); room.put("hints", List.of());
        room.put("tasks", tasks); room.put("revision", 0); room.put("tasksRevision", 0);
        return room;
    }

    private static Map<String, Object> flagTask(Object id, String flag) {
        var task = new LinkedHashMap<String, Object>();
        task.put("id", id); task.put("title", "Flaga"); task.put("content", "<p>Znajdź flagę</p>"); task.put("answer", flag);
        return task;
    }

    private String save(Account admin, Long id, Map<String, Object> room, int expected) throws Exception {
        var request = multipart("/api/admin/content/rooms" + (id == null ? "" : "/" + id))
                .file(new MockMultipartFile("content", "", "application/json", mapper.writeValueAsBytes(room)))
                .header("Authorization", "Bearer " + admin.token());
        if (id != null) request.with(r -> { r.setMethod("PUT"); return r; });
        return mockMvc.perform(request).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
    }

    private static long number(String json, String path) {
        return ((Number) JsonPath.read(json, path)).longValue();
    }

    private static void revise(Map<String, Object> room, String saved) {
        room.put("revision", number(saved, "$.room.contentRevision"));
        room.put("tasksRevision", number(saved, "$.tasks.revision"));
    }

    @Test
    void ctfRoomIsSolvedThroughItsFlagTaskWithAnExactMatch() throws Exception {
        var admin = account(Role.ADMIN);
        var player = account(Role.USER);
        String saved = save(admin, null, room("CTF", List.of(flagTask(null, "HACK{exact}"))), 201);
        long id = number(saved, "$.room.id");
        publishInPath(id);
        assertEquals("HACK{exact}", JsonPath.read(saved, "$.tasks.tasks[0].answer"));
        assertEquals(100, number(saved, "$.room.points"));

        getAs(admin, "/api/admin/content/rooms/" + id).andExpect(jsonPath("$.room.flag").doesNotExist());
        getAs(player, "/api/rooms/" + id).andExpect(status().isOk())
                .andExpect(jsonPath("$.roomType").value("CTF"))
                .andExpect(jsonPath("$.tasks[0].question").doesNotExist())
                .andExpect(jsonPath("$.tasks[0].requiresAnswer").value(true))
                .andExpect(jsonPath("$.tasks[0].answer").doesNotExist());
        mockMvc.perform(multipart("/api/rooms/" + id + "/solve").header("Authorization", "Bearer " + player.token()))
                .andExpect(status().is4xxClientError());

        solveRoom(player, id, "hack{exact}").andExpect(status().isBadRequest());
        solveRoom(player, id, "HACK{exact}").andExpect(status().isOk())
                .andExpect(jsonPath("$.pointsEarned").value(100));
        assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM user_solved_rooms WHERE room_id = ?", Integer.class, id));
    }

    @Test
    void visibleRoomsNeedTasksAndCtfTasksNeedAFlag() throws Exception {
        var admin = account(Role.ADMIN);
        List<Long> drafts = new java.util.ArrayList<>();
        for (var room : List.of(room("CTF", List.of()), room("PATH", List.of(flagTask(null, "HACK{x}"))), room("CTF", List.of(flagTask(null, ""))))) {
            drafts.add(number(save(admin, null, room, 201), "$.room.id"));
        }
        String rejected = mockMvc.perform(multipart("/api/admin/content/paths")
                        .file(new MockMultipartFile("content", "", "application/json", mapper.writeValueAsBytes(Map.of(
                                "title", uniqueTitle("Ścieżka"), "description", "Opis", "published", true, "revision", 0, "chaptersRevision", 0,
                                "chapters", List.of(Map.of("title", "Rozdział", "roomIds", drafts))))))
                        .header("Authorization", "Bearer " + admin.token()))
                .andExpect(status().isBadRequest()).andReturn().getResponse().getContentAsString();
        assertTrue(rejected.contains("dodaj przynajmniej jedno zadanie"));
        assertTrue(rejected.contains("zadanie 1: odpowiedź wymaga pytania"));
        assertTrue(rejected.contains("zadanie 1: podaj flagę"));

        var ready = room("CTF", List.of(flagTask(null, "HACK{x}")));
        String saved = save(admin, null, ready, 201);
        long id = number(saved, "$.room.id");
        publishInPath(id);
        revise(ready, saved);
        ready.put("tasks", List.of());
        assertTrue(save(admin, id, ready, 400).contains("\"tasks\""));
        ready.put("tasks", List.of(flagTask(number(saved, "$.tasks.tasks[0].id"), "")));
        assertTrue(save(admin, id, ready, 400).contains("tasks.0.answer"));
    }

    @Test
    void changingTheTypeKeepsTasksAndPlayerProgress() throws Exception {
        var admin = account(Role.ADMIN);
        var player = account(Role.USER);
        var theory = new LinkedHashMap<String, Object>(Map.of("title", "Pytanie", "content", "<p>Treść</p>", "question", "Polecenie?", "answer", "pwd"));
        var flag = flagTask(null, "HACK{two}");
        flag.put("question", "Flaga?");
        var room = room("PATH", List.of(theory, flag));
        String saved = save(admin, null, room, 201);
        long id = number(saved, "$.room.id");
        publishInPath(id);
        List<Integer> taskIds = JsonPath.read(saved, "$.tasks.tasks[*].id");
        solveRoom(player, id, "PWD").andExpect(status().isOk());

        revise(room, saved);
        room.put("roomType", "CTF");
        room.put("tasks", List.of(
                new LinkedHashMap<>(Map.of("id", taskIds.get(0), "title", "Pytanie", "content", "<p>Treść</p>", "question", "Polecenie?", "answer", "pwd")),
                new LinkedHashMap<>(Map.of("id", taskIds.get(1), "title", "Flaga", "content", "<p>Znajdź flagę</p>", "question", "Flaga?", "answer", "HACK{two}"))));
        saved = save(admin, id, room, 200);
        assertEquals("CTF", JsonPath.read(saved, "$.room.roomType"));
        assertEquals(taskIds, JsonPath.read(saved, "$.tasks.tasks[*].id"));
        assertEquals(List.of("Polecenie?", "Flaga?"), JsonPath.read(saved, "$.tasks.tasks[*].question"));

        revise(room, saved);
        room.put("roomType", "PATH");
        saved = save(admin, id, room, 200);
        assertEquals(taskIds, JsonPath.read(saved, "$.tasks.tasks[*].id"));
        assertEquals(List.of("pwd", "HACK{two}"), JsonPath.read(saved, "$.tasks.tasks[*].answer"));
        getAs(player, "/api/rooms/" + id).andExpect(jsonPath("$.tasks[0].completed").value(true))
                .andExpect(jsonPath("$.tasks[1].completed").value(false));
    }

    @Test
    void ctfRoomCanBeCreatedDirectlyInAPathChapter() throws Exception {
        var admin = account(Role.ADMIN);
        var path = mockMvc.perform(multipart("/api/admin/content/paths")
                        .file(new MockMultipartFile("content", "", "application/json", mapper.writeValueAsBytes(Map.of(
                                "title", uniqueTitle("Ścieżka"), "description", "", "published", false, "revision", 0, "chaptersRevision", 0,
                                "chapters", List.of(Map.of("title", "Rozdział", "roomIds", List.of()))))))
                        .header("Authorization", "Bearer " + admin.token()))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        var room = room("CTF", List.of(flagTask(null, "HACK{chapter}")));
        room.put("pathId", number(path, "$.id")); room.put("chapterId", number(path, "$.chapters[0].id")); room.put("pathRevision", number(path, "$.contentRevision"));

        String saved = save(admin, null, room, 201);

        assertEquals(number(path, "$.id"), number(saved, "$.pathId"));
        assertEquals("CTF", jdbcTemplate.queryForObject("SELECT r.room_type FROM rooms r JOIN chapter_rooms cr ON cr.room_id = r.id WHERE cr.chapter_id = ?",
                String.class, number(path, "$.chapters[0].id")));
    }
}
