package com.hackademy.server;

import com.fasterxml.jackson.databind.ObjectMapper;
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

@SpringBootTest(properties = "JWT_SECRET=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
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
    String token(Role role) throws Exception {
        String name = "u" + UUID.randomUUID().toString().substring(0, 10); String email = name + "@example.com";
        mvc.perform(post("/api/auth/register").contentType("application/json").content(mapper.writeValueAsString(Map.of("username", name, "email", email, "password", "password123")))).andExpect(status().isOk());
        var u = users.findByEmail(email).orElseThrow(); u.setRole(role); users.saveAndFlush(u);
        var response = mvc.perform(post("/api/auth/login").contentType("application/json").content(mapper.writeValueAsString(Map.of("email", email, "password", "password123")))).andExpect(status().isOk()).andReturn();
        return JsonPath.read(response.getResponse().getContentAsString(), "$.token");
    }
    Map<String, Object> room(boolean published, String type) {
        var r = new LinkedHashMap<String, Object>();
        r.put("title", "Room " + UUID.randomUUID()); r.put("description", published ? "Ready description" : ""); r.put("shortDescription", "");
        r.put("difficulty", "EASY"); r.put("category", "Web"); r.put("points", 50); r.put("flag", published ? "CTF{x}" : "");
        r.put("requiresVpn", false); r.put("roomType", type); r.put("hints", List.of()); r.put("published", published); r.put("tasks", List.of());
        r.put("revision", 0); r.put("tasksRevision", 0); return r;
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

    @Test void draftIsHiddenAcrossListsDirectLinksActionsFilesAndArenaAndPreviewHasNoSideEffects() throws Exception {
        String admin = token(Role.ADMIN), user = token(Role.USER), expert = token(Role.EXPERT);
        var request = room(false, "CTF"); request.put("hints", List.of("Secret hint"));
        String saved = save("rooms", null, request, admin, 201); long id = number(saved, "$.room.id");
        long hint = db.queryForObject("SELECT id FROM hints WHERE room_id = ?", Long.class, id);
        for (String uri : List.of("/api/rooms/" + id, "/api/rooms/" + id + "/file")) mvc.perform(get(uri).header("Authorization", "Bearer " + user)).andExpect(status().isNotFound());
        mvc.perform(post("/api/rooms/" + id + "/solve").header("Authorization", "Bearer " + user).contentType("application/json").content("{\"flag\":\"\"}")).andExpect(status().isNotFound());
        mvc.perform(post("/api/rooms/" + id + "/hints/" + hint + "/unlock").header("Authorization", "Bearer " + user)).andExpect(status().isBadRequest());
        for (String uri : List.of("/api/rooms", "/api/rooms/top3")) mvc.perform(get(uri).header("Authorization", "Bearer " + user)).andExpect(jsonPath("$[?(@.id == " + id + ")]").isEmpty());
        assertFalse(rooms.findCtfIdsByVpnRequirement(true).contains(id)); assertFalse(rooms.findAllIds().contains(id));
        mvc.perform(get("/api/admin/content/rooms/" + id + "/preview").header("Authorization", "Bearer " + user)).andExpect(status().isForbidden());
        for (String t : List.of(admin, expert)) mvc.perform(get("/api/admin/content/rooms/" + id + "/preview").header("Authorization", "Bearer " + t)).andExpect(status().isOk()).andExpect(jsonPath("$.hints[0].description").value("Secret hint"));
        assertEquals(0, db.queryForObject("SELECT count(*) FROM user_solved_rooms WHERE room_id = ?", Integer.class, id));
        assertEquals(0, db.queryForObject("SELECT count(*) FROM user_unlocked_hints WHERE hint_id = ?", Integer.class, hint));
        assertFalse(rooms.findById(id).orElseThrow().isPublished());
        reviseRoom(request, saved); request.put("published", true);
        String invalid = save("rooms", id, request, admin, 400); assertTrue(invalid.contains("description"));
        request.put("description", "Published"); request.put("flag", "CTF{x}"); saved = save("rooms", id, request, admin, 200);
        mvc.perform(get("/api/rooms/" + id).header("Authorization", "Bearer " + user)).andExpect(status().isOk());
        assertTrue(rooms.findCtfIdsByVpnRequirement(false).contains(id));
        mvc.perform(post("/api/rooms/" + id + "/solve").header("Authorization", "Bearer " + user).contentType("application/json").content("{\"flag\":\"CTF{x}\"}")).andExpect(status().isOk());
        reviseRoom(request, saved); request.put("title", request.get("title") + " updated"); saved = save("rooms", id, request, admin, 200);
        assertTrue(rooms.findById(id).orElseThrow().isPublished());
        reviseRoom(request, saved); request.put("published", false); save("rooms", id, request, admin, 200);
        mvc.perform(get("/api/rooms/" + id).header("Authorization", "Bearer " + user)).andExpect(status().isNotFound());
        assertEquals(1, db.queryForObject("SELECT count(*) FROM user_solved_rooms WHERE room_id = ?", Integer.class, id));
    }

    @Test void chapterCreationIsAtomicAndParentDraftHidesEvenPublishedRoomUntilPathPublication() throws Exception {
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
        // Stale parent is rejected before a second room can be created.
        r.put("title", "Stale " + UUID.randomUUID()); long before = rooms.count(); save("rooms", null, r, admin, 409); assertEquals(before, rooms.count());
        String latest = mvc.perform(get("/api/admin/paths/" + pathId).header("Authorization", "Bearer " + admin)).andReturn().getResponse().getContentAsString();
        revisePath(p, latest); p.put("published", true); p.put("description", "Published description"); p.put("chapters", List.of(Map.of("id", chapter, "title", "Chapter", "roomIds", List.of(roomId))));
        savedPath = save("paths", pathId, p, admin, 200);
        mvc.perform(get("/api/rooms/" + roomId).header("Authorization", "Bearer " + user)).andExpect(status().isOk());
        mvc.perform(get("/api/paths/" + pathId).header("Authorization", "Bearer " + user)).andExpect(status().isOk());
        revisePath(p, savedPath); p.put("published", false); save("paths", pathId, p, admin, 200);
        mvc.perform(get("/api/rooms/" + roomId).header("Authorization", "Bearer " + user)).andExpect(status().isNotFound());
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
        reviseRoom(r, saved); r.put("published", true); r.put("description", "Ready"); save("rooms", id, r, admin, 400);
        assertFalse(rooms.findById(id).orElseThrow().isPublished());
    }

    @Test void validatesSanitizedContentAndDuplicateTitleAtTheFieldWithoutPublishingOrLosingData() throws Exception {
        String admin = token(Role.ADMIN); var first = room(false, "PATH");
        save("rooms", null, first, admin, 201);
        String duplicate = save("rooms", null, first, admin, 409);
        assertTrue(duplicate.contains("title"));
        var malicious = room(true, "PATH"); malicious.put("tasks", List.of(Map.of("title", "Test", "content", "<script>alert(1)</script>")));
        String error = save("rooms", null, malicious, admin, 400);
        assertTrue(error.contains("tasks.0.content"));
    }

    @Test void enforcesAllTextLimitsBeforeSaving() throws Exception {
        String admin = token(Role.ADMIN);
        for (var field : Map.of("title", 255, "description", 20000, "shortDescription", 100, "category", 255, "flag", 255).entrySet()) {
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

    @Test void createsNewParentChapterAndRoomTogetherAndRollsBackOnInvalidContext() throws Exception {
        String admin = token(Role.ADMIN); var r = room(false, "PATH"); var p = path(false);
        r.put("parentDraft", p); r.put("chapterIndex", 3); long before = rooms.count(); long pathsBefore = db.queryForObject("SELECT count(*) FROM paths", Long.class);
        save("rooms", null, r, admin, 400); assertEquals(before, rooms.count()); assertEquals(pathsBefore, db.queryForObject("SELECT count(*) FROM paths", Long.class));
        r.put("chapterIndex", 0); String saved = save("rooms", null, r, admin, 201); long id = number(saved, "$.room.id");
        assertEquals(1, db.queryForObject("SELECT count(*) FROM chapter_rooms WHERE room_id = ?", Integer.class, id));
        assertNotNull(JsonPath.read(saved, "$.pathId"));
    }
}
