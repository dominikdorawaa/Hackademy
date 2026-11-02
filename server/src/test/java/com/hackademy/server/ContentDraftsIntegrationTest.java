package com.hackademy.server;

import tools.jackson.databind.ObjectMapper;
import com.hackademy.server.room.RoomRepository;
import com.hackademy.server.user.*;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class ContentDraftsIntegrationTest {
    @Container static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17.11-alpine");
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("DB_URL", postgres::getJdbcUrl); registry.add("DB_USERNAME", postgres::getUsername); registry.add("DB_PASSWORD", postgres::getPassword);
    }
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired RoomRepository rooms;
    @Autowired JdbcTemplate db;
    final ObjectMapper mapper = new ObjectMapper();
    String token(Role role) {
        return ClerkTestTokens.tokenFor(ClerkTestTokens.createUser(users, "u" + UUID.randomUUID().toString().substring(0, 10), role));
    }
    Map<String, Object> room(boolean ready, String type) {
        var r = new LinkedHashMap<String, Object>();
        r.put("title", "Room " + UUID.randomUUID()); r.put("description", ready ? "Ready description" : ""); r.put("shortDescription", "");
        r.put("difficulty", "EASY"); r.put("category", "Web"); r.put("points", 50);
        r.put("requiresVpn", false); r.put("roomType", type); r.put("hints", List.of()); r.put("tasks", ready ? List.of(task(type)) : List.of());
        r.put("revision", 0); r.put("tasksRevision", 0); return r;
    }
    Map<String, Object> task(String type) {
        return "CTF".equals(type) ? Map.of("title", "Flaga", "content", "Znajdź flagę", "answer", "CTF{x}")
                : Map.of("title", "Pytanie", "content", "Przeczytaj", "question", "Flaga?", "answer", "CTF{x}");
    }
    void join(String token, long pathId) throws Exception {
        mvc.perform(post("/api/paths/" + pathId + "/enroll").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
    }
    void solve(String token, long room, String answer, int expected) throws Exception {
        long task = db.queryForObject("SELECT id FROM room_tasks WHERE room_id = ? ORDER BY sort_order LIMIT 1", Long.class, room);
        mvc.perform(post("/api/rooms/" + room + "/tasks/" + task + "/solve").header("Authorization", "Bearer " + token)
                .contentType("application/json").content(mapper.writeValueAsString(Map.of("answer", answer)))).andExpect(status().is(expected));
    }
    Map<String, Object> path(boolean published) {
        var p = new LinkedHashMap<String, Object>(); p.put("title", "Path " + UUID.randomUUID()); p.put("description", published ? "Ready path" : "");
        p.put("bannerUrl", null); p.put("published", published); p.put("revision", 0); p.put("chaptersRevision", 0);
        p.put("chapters", List.of(Map.of("title", "Chapter", "roomIds", List.of()))); return p;
    }
    String save(String resource, Long id, Map<String, Object> data, String token, int expected) throws Exception {
        var part = new MockMultipartFile("content", "", "application/json", mapper.writeValueAsBytes(data));
        var req = multipart("/api/admin/content/" + resource + (id == null ? "" : "/" + id)).file(part).header("Authorization", "Bearer " + token);
        if (id != null) req.with(r -> { r.setMethod("PUT"); return r; });
        return mvc.perform(req).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
    }
    long number(String json, String path) { return ((Number) JsonPath.read(json, path)).longValue(); }
    void reviseRoom(Map<String, Object> request, String response) { request.put("revision", number(response, "$.room.contentRevision")); request.put("tasksRevision", number(response, "$.tasks.revision")); }
    void revisePath(Map<String, Object> request, String response) { request.put("revision", number(response, "$.contentRevision")); request.put("chaptersRevision", number(response, "$.revision")); }
    Map<String, Object> pathWith(boolean published, Long... roomIds) {
        var p = path(published); p.put("chapters", List.of(Map.of("title", "Chapter", "roomIds", List.of(roomIds)))); return p;
    }
    void chapterRooms(Map<String, Object> path, String saved, Long... roomIds) {
        revisePath(path, saved); path.put("chapters", List.of(Map.of("id", number(saved, "$.chapters[0].id"), "title", "Chapter", "roomIds", List.of(roomIds))));
    }
    String editor(String token, long room) throws Exception {
        return mvc.perform(get("/api/admin/content/rooms/" + room).header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    @Test void roomOutsidePublishedPathsIsHiddenAcrossListsDirectLinksActionsAndPreviewHasNoSideEffects() throws Exception {
        String admin = token(Role.ADMIN), user = token(Role.USER), expert = token(Role.EXPERT);
        var request = room(false, "CTF"); request.put("hints", List.of("Secret hint"));
        String saved = save("rooms", null, request, admin, 201); long id = number(saved, "$.room.id");
        long hint = db.queryForObject("SELECT id FROM hints WHERE room_id = ?", Long.class, id);
        for (String uri : List.of("/api/rooms/" + id, "/api/rooms/" + id + "/file")) mvc.perform(get(uri).header("Authorization", "Bearer " + user)).andExpect(status().isNotFound());
        mvc.perform(post("/api/rooms/" + id + "/tasks/complete").header("Authorization", "Bearer " + user)).andExpect(status().isNotFound());
        mvc.perform(post("/api/rooms/" + id + "/hints/" + hint + "/unlock").header("Authorization", "Bearer " + user)).andExpect(status().isNotFound());
        for (String uri : List.of("/api/rooms/top3")) mvc.perform(get(uri).header("Authorization", "Bearer " + user)).andExpect(jsonPath("$[?(@.id == " + id + ")]").isEmpty());
        assertFalse(rooms.findVisibleIds().contains(id));
        mvc.perform(get("/api/admin/content/rooms/" + id + "/preview").header("Authorization", "Bearer " + user)).andExpect(status().isForbidden());
        for (String t : List.of(admin, expert)) mvc.perform(get("/api/admin/content/rooms/" + id + "/preview").header("Authorization", "Bearer " + t)).andExpect(status().isOk()).andExpect(jsonPath("$.hints[0].description").value("Secret hint"));
        assertEquals(0, db.queryForObject("SELECT count(*) FROM user_solved_rooms WHERE room_id = ?", Integer.class, id));
        assertEquals(0, db.queryForObject("SELECT count(*) FROM user_unlocked_hints WHERE hint_id = ?", Integer.class, hint));
        assertEquals(false, JsonPath.read(saved, "$.live"));
        assertFalse(saved.contains("\"published\""));
        reviseRoom(request, saved); request.put("description", "Ready"); request.put("tasks", List.of(task("CTF"))); saved = save("rooms", id, request, admin, 200);
        mvc.perform(get("/api/rooms/" + id).header("Authorization", "Bearer " + user)).andExpect(status().isNotFound());
        assertFalse(rooms.findVisibleIds().contains(id));
        var p = pathWith(true, id); String savedPath = save("paths", null, p, admin, 201);
        mvc.perform(get("/api/rooms/" + id).header("Authorization", "Bearer " + user)).andExpect(status().isForbidden());
        join(user, number(savedPath, "$.id"));
        mvc.perform(get("/api/rooms/" + id).header("Authorization", "Bearer " + user)).andExpect(status().isOk());
        assertTrue(rooms.findVisibleIds().contains(id));
        solve(user, id, "CTF{x}", 200);
        saved = editor(admin, id); assertEquals(true, JsonPath.read(saved, "$.live"));
        reviseRoom(request, saved); request.put("description", "");
        String invalid = save("rooms", id, request, admin, 400); assertTrue(invalid.contains("description"));
        request.put("title", request.get("title") + " updated"); request.put("description", "Ready"); save("rooms", id, request, admin, 200);
        revisePath(p, savedPath); p.put("published", false); save("paths", number(savedPath, "$.id"), p, admin, 200);
        mvc.perform(get("/api/rooms/" + id).header("Authorization", "Bearer " + user)).andExpect(status().isNotFound());
        assertEquals(1, db.queryForObject("SELECT count(*) FROM user_solved_rooms WHERE room_id = ?", Integer.class, id));
    }

    @Test void chapterCreationIsAtomicAndDraftPathHidesReadyRoomUntilPathPublication() throws Exception {
        String admin = token(Role.ADMIN), user = token(Role.USER);
        var p = path(false); String savedPath = save("paths", null, p, admin, 201); long pathId = number(savedPath, "$.id"), chapter = number(savedPath, "$.chapters[0].id");
        var r = room(true, "PATH"); r.put("pathId", pathId); r.put("chapterId", chapter); r.put("pathRevision", number(savedPath, "$.contentRevision"));
        String saved = save("rooms", null, r, admin, 201); long roomId = number(saved, "$.room.id");
        assertEquals(pathId, number(saved, "$.pathId"));
        assertEquals(1, db.queryForObject("SELECT count(*) FROM chapter_rooms WHERE room_id = ? AND chapter_id = ?", Integer.class, roomId, chapter));
        mvc.perform(get("/api/rooms/" + roomId).header("Authorization", "Bearer " + user)).andExpect(status().isNotFound());
        for (String uri : List.of("/api/paths/" + pathId, "/api/paths/" + pathId + "/rooms-mini", "/api/paths/" + pathId + "/banner")) mvc.perform(get(uri).header("Authorization", "Bearer " + user)).andExpect(status().isNotFound());
        mvc.perform(post("/api/paths/" + pathId + "/enroll").header("Authorization", "Bearer " + user)).andExpect(status().isNotFound());
        mvc.perform(get("/api/admin/content/paths/" + pathId + "/preview").header("Authorization", "Bearer " + admin)).andExpect(status().isOk()).andExpect(jsonPath("$.chapters[0].rooms[0].id").value(roomId));
        mvc.perform(get("/api/admin/content/paths/" + pathId + "/preview").header("Authorization", "Bearer " + user)).andExpect(status().isForbidden());
        r.put("title", "Stale " + UUID.randomUUID()); long before = rooms.count(); save("rooms", null, r, admin, 409); assertEquals(before, rooms.count());
        String latest = mvc.perform(get("/api/admin/paths/" + pathId).header("Authorization", "Bearer " + admin)).andReturn().getResponse().getContentAsString();
        revisePath(p, latest); p.put("published", true); p.put("description", "Published description"); p.put("chapters", List.of(Map.of("id", chapter, "title", "Chapter", "roomIds", List.of(roomId))));
        savedPath = save("paths", pathId, p, admin, 200);
        join(user, pathId);
        mvc.perform(get("/api/rooms/" + roomId).header("Authorization", "Bearer " + user)).andExpect(status().isOk());
        mvc.perform(get("/api/paths/" + pathId).header("Authorization", "Bearer " + user)).andExpect(status().isOk());
        revisePath(p, savedPath); p.put("published", false); save("paths", pathId, p, admin, 200);
        mvc.perform(get("/api/rooms/" + roomId).header("Authorization", "Bearer " + user)).andExpect(status().isNotFound());
    }

    @Test void wrongAnswersCannotAwardPointsOrProgressForPublishedTaskRoom() throws Exception {
        String admin = token(Role.ADMIN), user = token(Role.USER);
        var r = room(true, "PATH");
        r.put("tasks", List.of(Map.of("title", "Question", "content", "Read this", "question", "Answer?", "answer", "correct")));
        String saved = save("rooms", null, r, admin, 201); long id = number(saved, "$.room.id");
        join(user, number(save("paths", null, pathWith(true, id), admin, 201), "$.id"));
        for (String submitted : List.of("", " ", "wrong")) solve(user, id, submitted, 400);
        mvc.perform(post("/api/rooms/" + id + "/tasks/complete").header("Authorization", "Bearer " + user)).andExpect(status().isBadRequest());
        assertEquals(0, db.queryForObject("SELECT count(*) FROM user_solved_rooms WHERE room_id = ?", Integer.class, id));
        assertEquals(0, db.queryForObject("SELECT count(*) FROM user_completed_tasks WHERE task_id IN (SELECT id FROM room_tasks WHERE room_id = ?)", Integer.class, id));
        assertEquals(0, rooms.findById(id).orElseThrow().getSolutionsCount());
        String username = users.findByClerkUserId(mapper.readTree(Base64.getUrlDecoder().decode(user.split("\\.")[1])).get("sub").asText()).orElseThrow().getUsername();
        var player = users.findByUsername(username).orElseThrow();
        assertEquals(0, player.getPoints()); assertEquals(0, player.getStreak()); assertNull(player.getLastSolvedDate());
        String taskSolve = "/api/rooms/" + id + "/tasks/" + number(saved, "$.tasks.tasks[0].id") + "/solve";
        mvc.perform(post(taskSolve).header("Authorization", "Bearer " + user).contentType("application/json").content("{\"answer\":\"correct\"}")).andExpect(status().isOk());
        mvc.perform(post("/api/rooms/" + id + "/tasks/complete").header("Authorization", "Bearer " + user)).andExpect(status().isOk());
        assertEquals(1, db.queryForObject("SELECT count(*) FROM user_solved_rooms WHERE room_id = ?", Integer.class, id));
        assertEquals(1, rooms.findById(id).orElseThrow().getSolutionsCount());
    }

    @Test void dashboardDropsHiddenPathsAndRoomsImmediatelyAfterCommittedSave() throws Exception {
        db.update("UPDATE paths SET published = false");
        String admin = token(Role.ADMIN), user = token(Role.USER);
        long roomId = number(save("rooms", null, room(true, "PATH"), admin, 201), "$.room.id");
        long otherId = number(save("rooms", null, room(true, "PATH"), admin, 201), "$.room.id");
        var p = pathWith(true, roomId, otherId);
        String savedPath = save("paths", null, p, admin, 201); long pathId = number(savedPath, "$.id");
        mvc.perform(post("/api/paths/" + pathId + "/enroll").header("Authorization", "Bearer " + user)).andExpect(status().isOk());
        String dashboard = "/api/dashboard/summary";
        mvc.perform(get(dashboard).header("Authorization", "Bearer " + user)).andExpect(status().isOk())
                .andExpect(jsonPath("$.currentPath.id").value(pathId)).andExpect(jsonPath("$.currentPathRoomsMini[0].id").value(roomId));
        chapterRooms(p, savedPath, otherId); savedPath = save("paths", pathId, p, admin, 200);
        mvc.perform(get(dashboard).header("Authorization", "Bearer " + user)).andExpect(status().isOk())
                .andExpect(jsonPath("$.currentPathRoomsMini.length()").value(1)).andExpect(jsonPath("$.currentPathRoomsMini[0].id").value(otherId));
        revisePath(p, savedPath); p.put("published", false); save("paths", pathId, p, admin, 200);
        mvc.perform(get(dashboard).header("Authorization", "Bearer " + user)).andExpect(status().isOk())
                .andExpect(jsonPath("$.currentPath").doesNotExist()).andExpect(jsonPath("$.pathsProgress").isEmpty())
                .andExpect(jsonPath("$.recommendedPath").doesNotExist());
    }

    private void assertCompletedProfile(String user, String username, long pathId, int expected) throws Exception {
        for (String profile : List.of("/api/user/me/stats", "/api/user/" + username + "/stats")) {
            mvc.perform(get(profile).header("Authorization", "Bearer " + user)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.completedPaths").value(expected));
        }
        mvc.perform(get("/api/user/" + username + "/portfolio").header("Authorization", "Bearer " + user))
                .andExpect(status().isOk()).andExpect(jsonPath("$.completedPaths.length()").value(expected));
        if (expected == 1) {
            mvc.perform(get("/api/user/" + username + "/portfolio").header("Authorization", "Bearer " + user))
                    .andExpect(jsonPath("$.completedPaths[0].id").value(pathId));
        }
    }

    @Test void completedPathStatsMatchPortfolioWhenRoomsLeaveOrJoinThePathAndItMovesBetweenDraftAndPublished() throws Exception {
        String admin = token(Role.ADMIN), user = token(Role.USER);
        String username = users.findByClerkUserId(mapper.readTree(Base64.getUrlDecoder().decode(user.split("\\.")[1])).get("sub").asText()).orElseThrow().getUsername();
        long firstId = number(save("rooms", null, room(true, "PATH"), admin, 201), "$.room.id");
        long secondId = number(save("rooms", null, room(true, "PATH"), admin, 201), "$.room.id");
        var p = pathWith(true, firstId, secondId);
        String savedPath = save("paths", null, p, admin, 201); long pathId = number(savedPath, "$.id");
        assertCompletedProfile(user, username, pathId, 0);
        join(user, pathId);
        solve(user, firstId, "CTF{x}", 200);
        assertCompletedProfile(user, username, pathId, 0);
        chapterRooms(p, savedPath, firstId); savedPath = save("paths", pathId, p, admin, 200);
        assertCompletedProfile(user, username, pathId, 1);
        chapterRooms(p, savedPath, secondId); savedPath = save("paths", pathId, p, admin, 200);
        assertCompletedProfile(user, username, pathId, 0);
        chapterRooms(p, savedPath, firstId, secondId); savedPath = save("paths", pathId, p, admin, 200);
        assertCompletedProfile(user, username, pathId, 0);
        solve(user, secondId, "CTF{x}", 200);
        assertCompletedProfile(user, username, pathId, 1);
        revisePath(p, savedPath); p.put("published", false); savedPath = save("paths", pathId, p, admin, 200);
        assertCompletedProfile(user, username, pathId, 0);
        revisePath(p, savedPath); p.put("published", true); save("paths", pathId, p, admin, 200);
        assertCompletedProfile(user, username, pathId, 1);
        assertEquals(2, db.queryForObject("SELECT count(*) FROM user_solved_rooms WHERE room_id IN (?, ?)", Integer.class, firstId, secondId));
    }

    @Test void savesIncompleteTasksRejectsLengthsAndRejectsStaleRevisionWithoutPartialChanges() throws Exception {
        String admin = token(Role.ADMIN); var r = room(false, "PATH");
        r.put("tasks", List.of(Map.of("title", "Task", "content", "", "question", "Pending question")));
        String saved = save("rooms", null, r, admin, 201); long id = number(saved, "$.room.id");
        assertEquals("", JsonPath.read(saved, "$.tasks.tasks[0].content"));
        reviseRoom(r, saved); r.put("title", "x".repeat(256)); save("rooms", id, r, admin, 400);
        assertNotEquals(r.get("title"), rooms.findById(id).orElseThrow().getTitle());
        r.put("title", "Changed " + UUID.randomUUID()); r.put("revision", 0); save("rooms", id, r, admin, 409);
        assertNotEquals(r.get("title"), rooms.findById(id).orElseThrow().getTitle());
        long pathsBefore = db.queryForObject("SELECT count(*) FROM paths", Long.class);
        String invalid = save("paths", null, pathWith(true, id), admin, 400);
        assertTrue(invalid.contains("chapters.0.rooms")); assertTrue(invalid.contains("uzupełnij opis")); assertTrue(invalid.contains("zadanie 1: podaj treść")); assertTrue(invalid.contains("zadanie 1: podaj odpowiedź na pytanie"));
        assertEquals(pathsBefore, db.queryForObject("SELECT count(*) FROM paths", Long.class));
        assertFalse(rooms.isVisible(id));
        String draft = save("paths", null, pathWith(false, id), admin, 201);
        var p = pathWith(false, id); revisePath(p, draft); p.put("published", true); p.put("description", "Ready path");
        assertTrue(save("paths", number(draft, "$.id"), p, admin, 400).contains("chapters.0.rooms"));
        assertEquals(Boolean.FALSE, db.queryForObject("SELECT published FROM paths WHERE id = ?", Boolean.class, number(draft, "$.id")));
        assertFalse(rooms.isVisible(id));
    }

    @Test void validatesSanitizedContentAtTheFieldOnceTheRoomJoinsAPublishedPath() throws Exception {
        String admin = token(Role.ADMIN);
        long readyId = number(save("rooms", null, room(true, "PATH"), admin, 201), "$.room.id");
        String published = save("paths", null, pathWith(true, readyId), admin, 201);
        var malicious = room(true, "PATH"); malicious.put("tasks", List.of(Map.of("title", "Test", "content", "<script>alert(1)</script>")));
        malicious.put("pathId", number(published, "$.id")); malicious.put("chapterId", number(published, "$.chapters[0].id")); malicious.put("pathRevision", number(published, "$.contentRevision"));
        long before = rooms.count();
        assertTrue(save("rooms", null, malicious, admin, 400).contains("tasks.0.content"));
        assertEquals(before, rooms.count());
        malicious.remove("pathId"); malicious.remove("chapterId"); malicious.remove("pathRevision");
        long draftId = number(save("rooms", null, malicious, admin, 201), "$.room.id");
        assertTrue(save("paths", null, pathWith(true, draftId), admin, 400).contains("podaj treść"));
    }

    @Test void enforcesAllTextLimitsBeforeSaving() throws Exception {
        String admin = token(Role.ADMIN);
        for (var field : Map.of("title", 255, "description", 20000, "shortDescription", 100, "category", 255).entrySet()) {
            var r = room(false, "CTF"); r.put(field.getKey(), "x".repeat(field.getValue() + 1));
            assertTrue(save("rooms", null, r, admin, 400).contains(field.getKey()));
        }
        for (var field : Map.of("title", 120, "description", 20000, "bannerUrl", 2048).entrySet()) {
            var p = path(false); p.put(field.getKey(), "x".repeat(field.getValue() + 1));
            assertTrue(save("paths", null, p, admin, 400).contains(field.getKey()));
        }
        var p = path(false); p.put("chapters", List.of(Map.of("title", "x".repeat(121), "roomIds", List.of())));
        assertTrue(save("paths", null, p, admin, 400).contains("chapters.0.title"));
        for (var field : Map.of("title", 255, "content", 20000, "question", 2000, "answer", 255).entrySet()) {
            var r = room(false, "PATH"); var task = new HashMap<String, Object>(); task.put("title", "Task"); task.put("content", "");
            task.put(field.getKey(), "x".repeat(field.getValue() + 1)); r.put("tasks", List.of(task));
            assertTrue(save("rooms", null, r, admin, 400).contains("tasks.0." + field.getKey()));
        }
        var r = room(false, "CTF"); r.put("hints", List.of("x".repeat(2001)));
        assertTrue(save("rooms", null, r, admin, 400).contains("hints.0"));
    }

    @Test void protectsDraftBannerAndRoomFileAndPreservesUploadsDuringEdits() throws Exception {
        String admin = token(Role.ADMIN), user = token(Role.USER), expert = token(Role.EXPERT);
        var p = path(false); byte[] image = new byte[] {1, 2, 3};
        var request = multipart("/api/admin/content/paths").file(new MockMultipartFile("content", "", "application/json", mapper.writeValueAsBytes(p)))
                .file(new MockMultipartFile("file", "banner.png", "image/png", image)).header("Authorization", "Bearer " + admin);
        String saved = mvc.perform(request).andExpect(status().isCreated()).andExpect(jsonPath("$.hasBanner").value(true)).andReturn().getResponse().getContentAsString();
        long id = number(saved, "$.id");
        for (String token : List.of(admin, expert)) mvc.perform(get("/api/admin/content/paths/" + id + "/banner").header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andExpect(content().bytes(image));
        mvc.perform(get("/api/admin/content/paths/" + id + "/banner").header("Authorization", "Bearer " + user)).andExpect(status().isForbidden());
        mvc.perform(get("/api/paths/" + id + "/banner")).andExpect(status().isNotFound());
        revisePath(p, saved); p.put("title", p.get("title") + " edited"); save("paths", id, p, admin, 200);
        mvc.perform(get("/api/admin/content/paths/" + id + "/banner").header("Authorization", "Bearer " + admin)).andExpect(status().isOk()).andExpect(content().bytes(image));
        var r = room(false, "CTF"); byte[] file = new byte[] {4, 5, 6};
        var roomRequest = multipart("/api/admin/content/rooms").file(new MockMultipartFile("content", "", "application/json", mapper.writeValueAsBytes(r)))
                .file(new MockMultipartFile("file", "training.bin", "application/octet-stream", file)).header("Authorization", "Bearer " + admin);
        String roomSaved = mvc.perform(roomRequest).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(); long roomId = number(roomSaved, "$.room.id");
        mvc.perform(get("/api/admin/content/rooms/" + roomId).header("Authorization", "Bearer " + admin)).andExpect(status().isOk());
        mvc.perform(get("/api/admin/content/rooms/" + roomId + "/file").header("Authorization", "Bearer " + admin)).andExpect(status().isOk()).andExpect(content().bytes(file));
        mvc.perform(get("/api/admin/content/rooms/" + roomId + "/file").header("Authorization", "Bearer " + user)).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/content/rooms/" + roomId + "/preview").header("Authorization", "Bearer " + admin)).andExpect(jsonPath("$.fileName").value("training.bin"));
        mvc.perform(get("/api/rooms/" + roomId + "/file").header("Authorization", "Bearer " + user)).andExpect(status().isNotFound());
        reviseRoom(r, roomSaved); String updatedRoom = save("rooms", roomId, r, admin, 200);
        mvc.perform(get("/api/admin/content/rooms/" + roomId + "/file").header("Authorization", "Bearer " + admin)).andExpect(content().bytes(file));
        reviseRoom(r, updatedRoom); r.put("description", "Ready"); r.put("tasks", List.of(task("CTF"))); save("rooms", roomId, r, admin, 200);
        mvc.perform(get("/api/rooms/" + roomId + "/file").header("Authorization", "Bearer " + user)).andExpect(status().isNotFound());
        var learningRoom = room(true, "PATH"); String learning = save("rooms", null, learningRoom, admin, 201); long learningId = number(learning, "$.room.id");
        String latestPath = mvc.perform(get("/api/admin/paths/" + id).header("Authorization", "Bearer " + admin)).andReturn().getResponse().getContentAsString();
        revisePath(p, latestPath); p.put("published", true); p.put("description", "Ready"); p.put("chapters", List.of(Map.of("id", number(latestPath, "$.chapters[0].id"), "title", "Chapter", "roomIds", List.of(learningId, roomId))));
        save("paths", id, p, admin, 200);
        mvc.perform(get("/api/rooms/" + roomId + "/file").header("Authorization", "Bearer " + user)).andExpect(status().isForbidden());
        mvc.perform(get("/api/paths/" + id + "/banner")).andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store")).andExpect(content().bytes(image));
        mvc.perform(get("/api/paths/" + id + "/enrolled").header("Authorization", "Bearer " + user)).andExpect(status().isOk()).andExpect(content().string("false"));
        mvc.perform(post("/api/paths/" + id + "/enroll").header("Authorization", "Bearer " + user)).andExpect(status().isOk());
        mvc.perform(get("/api/paths/" + id + "/enrolled").header("Authorization", "Bearer " + user)).andExpect(content().string("true"));
        mvc.perform(get("/api/rooms/" + roomId + "/file").header("Authorization", "Bearer " + user)).andExpect(status().isOk()).andExpect(content().bytes(file));
        mvc.perform(get("/api/admin/paths").header("Authorization", "Bearer " + expert)).andExpect(status().isOk()).andExpect(jsonPath("$[?(@.id == " + id + ")].published").value(org.hamcrest.Matchers.contains(true)));
    }

    @Test void createsChapterOnPublishedParentAtomicallyAndNeverSilentlyHidesIt() throws Exception {
        String admin = token(Role.ADMIN); var initialRoom = room(true, "PATH");
        String roomSaved = save("rooms", null, initialRoom, admin, 201); long roomId = number(roomSaved, "$.room.id");
        var p = path(true); p.put("chapters", List.of(Map.of("title", "Existing chapter", "roomIds", List.of(roomId))));
        String saved = save("paths", null, p, admin, 201); long pathId = number(saved, "$.id"), chapterId = number(saved, "$.chapters[0].id");
        revisePath(p, saved); p.put("chapters", List.of(Map.of("id", chapterId, "title", "Existing chapter", "roomIds", List.of(roomId)), Map.of("title", "New chapter", "roomIds", List.of())));
        var r = room(false, "PATH"); r.put("parentDraft", p); r.put("chapterIndex", 1); r.put("pathId", pathId);
        long before = rooms.count(); save("rooms", null, r, admin, 400); assertEquals(before, rooms.count());
        assertEquals(Boolean.TRUE, db.queryForObject("SELECT published FROM paths WHERE id = ?", Boolean.class, pathId));
        assertEquals(1, db.queryForObject("SELECT count(*) FROM path_chapters WHERE path_id = ?", Integer.class, pathId));
        r.put("description", "Ready"); r.put("tasks", List.of(task("PATH")));
        String created = save("rooms", null, r, admin, 201); long added = number(created, "$.room.id");
        assertEquals(Boolean.TRUE, db.queryForObject("SELECT published FROM paths WHERE id = ?", Boolean.class, pathId));
        assertEquals(2, db.queryForObject("SELECT count(*) FROM path_chapters WHERE path_id = ?", Integer.class, pathId));
        assertEquals(2, db.queryForObject("SELECT count(*) FROM chapter_rooms cr JOIN path_chapters c ON c.id = cr.chapter_id WHERE c.path_id = ?", Integer.class, pathId));
        assertTrue(rooms.isVisible(added));
    }

    @Test void createsNewParentChapterAndRoomTogetherAndRollsBackOnInvalidContext() throws Exception {
        String admin = token(Role.ADMIN); var r = room(false, "PATH"); var p = path(false);
        r.put("parentDraft", p); r.put("chapterIndex", 3); long before = rooms.count(); long pathsBefore = db.queryForObject("SELECT count(*) FROM paths", Long.class);
        save("rooms", null, r, admin, 400); assertEquals(before, rooms.count()); assertEquals(pathsBefore, db.queryForObject("SELECT count(*) FROM paths", Long.class));
        r.put("chapterIndex", 0); String saved = save("rooms", null, r, admin, 201); long id = number(saved, "$.room.id");
        assertEquals(1, db.queryForObject("SELECT count(*) FROM chapter_rooms WHERE room_id = ?", Integer.class, id));
        assertNotNull(JsonPath.read(saved, "$.pathId"));
    }
}
