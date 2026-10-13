package com.hackademy.server;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hackademy.server.room.DifficultyLevel;
import com.hackademy.server.room.RoomService;
import com.hackademy.server.room.RoomType;
import com.hackademy.server.room.dto.UpdateRoomRequest;
import com.hackademy.server.user.Role;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class RoomTitleAndScoringIntegrationTest extends PostgresIntegrationTest {
    @Autowired private RoomService roomService;
    @Autowired private PlatformTransactionManager transactionManager;
    private final ObjectMapper mapper = new ObjectMapper();

    private Map<String, Object> room(String title, String type) {
        var room = new LinkedHashMap<String, Object>();
        room.put("title", title); room.put("description", ""); room.put("shortDescription", "");
        room.put("difficulty", "EASY"); room.put("category", "Web"); room.put("points", 30); room.put("flag", "");
        room.put("requiresVpn", false); room.put("roomType", type); room.put("hints", List.of()); room.put("published", false);
        room.put("tasks", List.of()); room.put("revision", 0); room.put("tasksRevision", 0);
        return room;
    }

    private Map<String, Object> path(List<Map<String, Object>> chapters) {
        var path = new LinkedHashMap<String, Object>();
        path.put("title", uniqueTitle("Path")); path.put("description", ""); path.put("bannerUrl", null); path.put("published", false);
        path.put("revision", 0); path.put("chaptersRevision", 0); path.put("chapters", chapters);
        return path;
    }

    private Map<String, Object> chapter(String title, List<Long> roomIds) {
        var chapter = new HashMap<String, Object>();
        chapter.put("title", title); chapter.put("roomIds", roomIds);
        return chapter;
    }

    private String save(Account account, String resource, Long id, Map<String, Object> data, int expected) throws Exception {
        var part = new MockMultipartFile("content", "", MediaType.APPLICATION_JSON_VALUE, mapper.writeValueAsBytes(data));
        var request = id == null ? multipart("/api/admin/content/" + resource) : multipart(HttpMethod.PUT, "/api/admin/content/" + resource + "/" + id);
        return mockMvc.perform(request.file(part).header("Authorization", "Bearer " + account.token()))
                .andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
    }

    private String legacyRoom(Account account, Long id, String json, int expected) throws Exception {
        var part = new MockMultipartFile("room", "", MediaType.APPLICATION_JSON_VALUE, json.getBytes(StandardCharsets.UTF_8));
        var request = id == null ? multipart("/api/admin/rooms") : multipart(HttpMethod.PUT, "/api/admin/rooms/" + id);
        return mockMvc.perform(request.file(part).header("Authorization", "Bearer " + account.token()))
                .andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
    }

    private long number(String json, String path) {
        return ((Number) JsonPath.read(json, path)).longValue();
    }

    private String field(String json, String name) {
        return JsonPath.read(json, "$.fields['" + name + "']");
    }

    private void revise(Map<String, Object> room, String saved) {
        room.put("revision", number(saved, "$.room.contentRevision"));
        room.put("tasksRevision", number(saved, "$.tasks.revision"));
    }

    @Test
    void ctfTitlesAreUniqueAcrossCtfRoomsOnly() throws Exception {
        var admin = account(Role.ADMIN);
        String title = uniqueTitle("Ctf");
        save(admin, "rooms", null, room(title, "CTF"), 201);
        String duplicate = save(admin, "rooms", null, room(" " + title + " ", "CTF"), 409);
        assertEquals("Pokój CTF o tym tytule już istnieje", field(duplicate, "title"));
        legacyRoom(admin, null, """
                {"title":"%s","description":"d","difficulty":"EASY","category":"Web","flag":"f","requiresVpn":false,"roomType":"CTF","hints":[]}
                """.formatted(title), 409);

        save(admin, "rooms", null, room(title, "PATH"), 201);
        String loose = uniqueTitle("Loose");
        save(admin, "rooms", null, room(loose, "PATH"), 201);
        String sameLoose = save(admin, "rooms", null, room(loose, "PATH"), 201);
        assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM rooms WHERE title = ? AND room_type = 'CTF'", Integer.class, title));
        assertEquals(2, jdbcTemplate.queryForObject("SELECT count(*) FROM rooms WHERE title = ?", Integer.class, loose));

        var change = room(title, "CTF");
        revise(change, sameLoose);
        String typeChange = save(admin, "rooms", number(sameLoose, "$.room.id"), change, 409);
        assertEquals("Pokój CTF o tym tytule już istnieje", field(typeChange, "title"));
        assertEquals("PATH", jdbcTemplate.queryForObject("SELECT room_type FROM rooms WHERE id = ?", String.class, number(sameLoose, "$.room.id")));
    }

    @Test
    void pathRoomTitlesAreUniqueWithinAChapter() throws Exception {
        var admin = account(Role.ADMIN);
        String title = uniqueTitle("Intro");
        long first = number(save(admin, "rooms", null, room(title, "PATH"), 201), "$.room.id");
        long second = number(save(admin, "rooms", null, room(title, "PATH"), 201), "$.room.id");
        long extra = number(save(admin, "rooms", null, room(title, "PATH"), 201), "$.room.id");

        String rejected = save(admin, "paths", null, path(List.of(chapter("A", List.of(first, second)))), 409);
        assertEquals("Rozdział 1 zawiera już pokój „" + title + "”", field(rejected, "chapters.0.rooms"));
        String secondChapter = save(admin, "paths", null, path(List.of(chapter("A", List.of(first)), chapter("B", List.of()), chapter("C", List.of(second, extra)))), 409);
        assertEquals("Rozdział 3 zawiera już pokój \u201e" + title + "\u201d", field(secondChapter, "chapters.2.rooms"));

        String saved = save(admin, "paths", null, path(List.of(chapter("A", List.of(first)), chapter("B", List.of(second)))), 201);
        long pathId = number(saved, "$.id");
        long chapterA = number(saved, "$.chapters[0].id");
        long chapterB = number(saved, "$.chapters[1].id");

        putJson(admin, "/api/admin/paths/" + pathId + "/chapters", """
                {"revision":%d,"chapters":[{"id":%d,"title":"A","roomIds":[%d,%d]},{"id":%d,"title":"B","roomIds":[]}]}
                """.formatted(number(saved, "$.revision"), chapterA, first, second, chapterB))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString(title)));
        String shared = uniqueTitle("Shared");
        long third = number(save(admin, "rooms", null, room(shared, "PATH"), 201), "$.room.id");
        long fourth = number(save(admin, "rooms", null, room(shared, "PATH"), 201), "$.room.id");
        long paths = jdbcTemplate.queryForObject("SELECT count(*) FROM paths", Long.class);
        postJson(admin, "/api/admin/paths", """
                {"title":"%s","roomIds":[%d,%d]}
                """.formatted(uniqueTitle("Legacy"), third, fourth)).andExpect(status().isConflict());
        assertEquals(paths, jdbcTemplate.queryForObject("SELECT count(*) FROM paths", Long.class));
        assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM chapter_rooms WHERE chapter_id = ?", Integer.class, chapterA));
    }

    @Test
    void creatingOrRenamingARoomCannotDuplicateATitleInItsChapter() throws Exception {
        var admin = account(Role.ADMIN);
        String title = uniqueTitle("Intro");
        long existing = number(save(admin, "rooms", null, room(title, "PATH"), 201), "$.room.id");
        var otherRoom = room(uniqueTitle("Other"), "PATH");
        String otherSaved = save(admin, "rooms", null, otherRoom, 201);
        long other = number(otherSaved, "$.room.id");
        String elsewhere = uniqueTitle("Elsewhere");
        long movable = number(save(admin, "rooms", null, room(elsewhere, "PATH"), 201), "$.room.id");
        String saved = save(admin, "paths", null, path(List.of(chapter("A", List.of(existing, other)), chapter("B", List.of(movable)))), 201);
        long pathId = number(saved, "$.id");
        long chapterA = number(saved, "$.chapters[0].id");

        var inChapter = room(title, "PATH");
        inChapter.put("pathId", pathId); inChapter.put("chapterId", chapterA); inChapter.put("pathRevision", number(saved, "$.contentRevision"));
        long before = jdbcTemplate.queryForObject("SELECT count(*) FROM rooms", Long.class);
        String rejected = save(admin, "rooms", null, inChapter, 409);
        assertEquals("Ten rozdział ma już pokój o tym tytule", field(rejected, "title"));
        assertEquals(before, jdbcTemplate.queryForObject("SELECT count(*) FROM rooms", Long.class));

        revise(otherRoom, otherSaved);
        otherRoom.put("title", title);
        String renamed = save(admin, "rooms", other, otherRoom, 409);
        assertEquals("Rozdział tego pokoju ma już pokój o tym tytule", field(renamed, "title"));
        otherRoom.put("title", elsewhere);
        save(admin, "rooms", other, otherRoom, 200);
        assertEquals(elsewhere, jdbcTemplate.queryForObject("SELECT room_title FROM chapter_rooms WHERE room_id = ?", String.class, other));
    }

    @Test
    void databaseRejectsAChapterTitleCollisionCreatedConcurrently() throws Exception {
        var admin = account(Role.ADMIN);
        long renamed = number(save(admin, "rooms", null, room(uniqueTitle("Before"), "PATH"), 201), "$.room.id");
        String saved = save(admin, "paths", null, path(List.of(chapter("A", List.of(renamed)))), 201);
        String title = uniqueTitle("Collision");
        var created = room(title, "PATH");
        created.put("pathId", number(saved, "$.id")); created.put("chapterId", number(saved, "$.chapters[0].id"));
        created.put("pathRevision", number(saved, "$.contentRevision"));

        var executor = Executors.newFixedThreadPool(2);
        var ready = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        try {
            var holder = executor.submit(() -> new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                try {
                    roomService.updateRoom(renamed, new UpdateRoomRequest(title, "", "", DifficultyLevel.EASY, "Web", 30, "", false, RoomType.PATH, List.of()), null);
                    status.flush();
                    ready.countDown();
                    if (!release.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Commit barrier timed out");
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            }));
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            var contender = executor.submit(() -> save(admin, "rooms", null, created, 409));
            boolean waiting = false;
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
            while (System.nanoTime() < deadline && !contender.isDone()) {
                waiting = Boolean.TRUE.equals(jdbcTemplate.queryForObject("""
                        SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query ILIKE '%chapter_rooms%')
                        """, Boolean.class));
                if (waiting) break;
                Thread.sleep(20);
            }
            assertTrue(waiting, "The new assignment must wait for the uncommitted rename");
            release.countDown();
            holder.get(10, TimeUnit.SECONDS);
            assertEquals("Ten rozdział ma już pokój o tym tytule", field(contender.get(10, TimeUnit.SECONDS), "title"));
        } finally {
            release.countDown();
            executor.shutdownNow();
            assertTrue(executor.awaitTermination(10, TimeUnit.SECONDS));
        }
        assertEquals(0, jdbcTemplate.queryForObject("SELECT count(*) FROM rooms WHERE title = ? AND id <> ?", Integer.class, title, renamed));
    }

    @Test
    void tutorialTitlesAreReservedForNewRooms() throws Exception {
        var admin = account(Role.ADMIN);
        for (var reserved : List.of(room("Tutorial VM", "CTF"), room(" tutorial vpn ", "PATH"))) {
            String rejected = save(admin, "rooms", null, reserved, 400);
            assertTrue(field(rejected, "title").contains("zarezerwowane"));
        }
        legacyRoom(admin, null, """
                {"title":"TUTORIAL VM","description":"d","difficulty":"EASY","category":"Tutorial","flag":"f","requiresVpn":false,"roomType":"CTF","hints":[]}
                """, 400);

        var ordinary = room(uniqueTitle("Ordinary"), "CTF");
        String ordinarySaved = save(admin, "rooms", null, ordinary, 201);
        revise(ordinary, ordinarySaved);
        ordinary.put("title", "Tutorial VPN");
        save(admin, "rooms", number(ordinarySaved, "$.room.id"), ordinary, 400);

        long tutorial = jdbcTemplate.queryForObject("""
                INSERT INTO rooms (title, description, difficulty, category, points, flag, solutions_count, requires_vpn, room_type, created_at, updated_at, published)
                VALUES ('Tutorial VM', 'd', 'EASY', 'Tutorial', 50, 'f', 0, false, 'CTF', now(), now(), true) RETURNING id
                """, Long.class);
        try {
            var edit = room("Tutorial VM", "CTF");
            edit.put("published", true); edit.put("description", "Updated"); edit.put("flag", "f"); edit.put("category", "Tutorial");
            save(admin, "rooms", tutorial, edit, 200);
            assertEquals("Updated", jdbcTemplate.queryForObject("SELECT description FROM rooms WHERE id = ?", String.class, tutorial));
        } finally {
            jdbcTemplate.update("DELETE FROM rooms WHERE id = ?", tutorial);
        }
    }

    @Test
    void backendDerivesCtfPointsFromDifficultyAndKeepsPathPoints() throws Exception {
        var admin = account(Role.ADMIN);
        var ctf = room(uniqueTitle("Scored"), "CTF");
        ctf.put("difficulty", "MEDIUM"); ctf.put("points", 7);
        String saved = save(admin, "rooms", null, ctf, 201);
        long ctfId = number(saved, "$.room.id");
        assertEquals(100, number(saved, "$.room.points"));
        revise(ctf, saved);
        ctf.put("difficulty", "INSANE"); ctf.put("points", null);
        assertEquals(200, number(save(admin, "rooms", ctfId, ctf, 200), "$.room.points"));

        String legacy = legacyRoom(admin, null, """
                {"title":"%s","description":"d","difficulty":"HARD","category":"Web","points":1,"flag":"f","requiresVpn":false,"roomType":"CTF","hints":[]}
                """.formatted(uniqueTitle("Legacy")), 201);
        assertEquals(150, number(legacy, "$.points"));
        String legacyTitle = JsonPath.read(legacy, "$.title");
        legacyRoom(admin, number(legacy, "$.id"), """
                {"title":"%s","description":"d","difficulty":"EASY","points":999,"category":"Web","flag":"f","requiresVpn":false,"roomType":"CTF","hints":[]}
                """.formatted(legacyTitle), 200);
        assertEquals(50, jdbcTemplate.queryForObject("SELECT points FROM rooms WHERE id = ?", Integer.class, number(legacy, "$.id")));

        var path = room(uniqueTitle("Learning"), "PATH");
        path.put("difficulty", "HARD"); path.put("points", 30);
        String pathSaved = save(admin, "rooms", null, path, 201);
        assertEquals(30, number(pathSaved, "$.room.points"));
        var missing = room(uniqueTitle("Missing"), "PATH");
        missing.put("points", null);
        assertTrue(save(admin, "rooms", null, missing, 400).contains("points"));
        legacyRoom(admin, null, """
                {"title":"%s","description":"d","difficulty":"EASY","category":"Path","flag":"f","requiresVpn":false,"roomType":"PATH","hints":[]}
                """.formatted(uniqueTitle("No points")), 400);

        revise(path, pathSaved);
        path.put("roomType", "CTF");
        assertEquals(150, number(save(admin, "rooms", number(pathSaved, "$.room.id"), path, 200), "$.room.points"));
    }

    @Test
    void expertsGetTheSameRuleErrors() throws Exception {
        var expert = account(Role.EXPERT);
        String title = "Expert " + UUID.randomUUID();
        save(expert, "rooms", null, room(title, "CTF"), 201);
        assertEquals("Pokój CTF o tym tytule już istnieje", field(save(expert, "rooms", null, room(title, "CTF"), 409), "title"));
    }
}
