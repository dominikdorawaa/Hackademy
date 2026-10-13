package com.hackademy.server;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hackademy.server.content.ContentImportReader;
import com.hackademy.server.content.CtfImportService;
import com.hackademy.server.room.RoomService;
import com.hackademy.server.room.dto.CreateRoomRequest;
import com.hackademy.server.user.Role;
import com.jayway.jsonpath.JsonPath;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CtfImportIntegrationTest extends PostgresIntegrationTest {
    private final ObjectMapper json = new ObjectMapper();
    @Autowired private CtfImportService importer;
    @Autowired private PlatformTransactionManager transactionManager;
    @MockitoSpyBean private RoomService roomService;

    private ObjectNode document() throws IOException {
        var root = (ObjectNode) json.readTree(Files.readString(Path.of("../client/src/data/ctf-import-example.json")));
        root.path("rooms").forEach(room -> ((ObjectNode) room).put("title", uniqueTitle(room.path("title").asText())));
        return root;
    }

    private ObjectNode room(ObjectNode doc, int index) { return (ObjectNode) doc.path("rooms").get(index); }
    private MockMultipartFile file(String content) { return new MockMultipartFile("file", "ctf.json", "application/json", content.getBytes(StandardCharsets.UTF_8)); }
    private String upload(Account admin, String content, int expected) throws Exception {
        return mockMvc.perform(multipart("/api/admin/content/ctf/import").file(file(content)).header("Authorization", "Bearer " + admin.token()))
                .andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
    }
    private Map<String, Long> counts() {
        var result = new LinkedHashMap<String, Long>();
        for (String table : List.of("rooms", "hints", "room_tasks", "room_files", "chapter_rooms", "paths")) {
            result.put(table, jdbcTemplate.queryForObject("SELECT count(*) FROM " + table, Long.class));
        }
        return result;
    }
    private Map<String, String> reject(Account admin, ObjectNode doc) throws Exception {
        var before = counts(); String response = upload(admin, doc.toString(), 400); assertEquals(before, counts());
        return JsonPath.read(response, "$.fields");
    }

    @Test
    void importsTheUiExampleAsCtfDraftsAndDerivesAllFourPointValues() throws Exception {
        var admin = account(Role.ADMIN); var user = account(Role.USER); var doc = document();
        String response = upload(admin, doc.toString(), 201);
        assertEquals(4, ((Number) JsonPath.read(response, "$.count")).intValue());
        List<Number> ids = JsonPath.read(response, "$.roomIds"); assertEquals(4, ids.size());
        int[] points = {50, 100, 150, 200};
        for (int i = 0; i < ids.size(); i++) {
            long id = ids.get(i).longValue(); var row = jdbcTemplate.queryForMap("SELECT * FROM rooms WHERE id = ?", id);
            assertEquals(room(doc, i).path("title").asText(), row.get("title"));
            assertEquals("CTF", row.get("room_type")); assertEquals(false, row.get("published")); assertEquals(points[i], row.get("points"));
            assertEquals(room(doc, i).path("flag").asText(), row.get("flag"));
            assertEquals(room(doc, i).path("requiresVpn").asBoolean(false), row.get("requires_vpn"));
            assertEquals(0, jdbcTemplate.queryForObject("SELECT count(*) FROM room_tasks WHERE room_id = ?", Integer.class, id));
            assertEquals(0, jdbcTemplate.queryForObject("SELECT count(*) FROM chapter_rooms WHERE room_id = ?", Integer.class, id));
            assertEquals(0, jdbcTemplate.queryForObject("SELECT count(*) FROM room_files WHERE room_id = ?", Integer.class, id));
            getAs(admin, "/api/admin/content/rooms/" + id).andExpect(status().isOk());
            getAs(user, "/api/rooms/" + id).andExpect(status().isNotFound());
        }
        assertEquals(List.of(room(doc, 0).path("hints").get(0).asText()), jdbcTemplate.queryForList("SELECT description FROM hints WHERE room_id = ? ORDER BY id", String.class, ids.get(0).longValue()));
        assertEquals("", jdbcTemplate.queryForObject("SELECT short_description FROM rooms WHERE id = ?", String.class, ids.get(1).longValue()));
    }

    @Test
    void reportsAllFileAndDatabaseTitleConflictsAlongsideOtherValidationErrors() throws Exception {
        var admin = account(Role.ADMIN); String published = uniqueTitle("Published"), draft = uniqueTitle("Draft");
        long publishedId = createRoom(admin, published, "CTF"); long draftId = createRoom(admin, draft, "CTF");
        jdbcTemplate.update("UPDATE rooms SET published = false WHERE id = ?", draftId);
        var originals = jdbcTemplate.queryForList("SELECT * FROM rooms WHERE id IN (?, ?) ORDER BY id", publishedId, draftId);
        var doc = document(); room(doc, 0).put("title", " " + published + " ").put("flag", "");
        room(doc, 1).put("title", draft); room(doc, 2).put("title", published); room(doc, 3).put("difficulty", "UNKNOWN");
        var errors = reject(admin, doc);
        assertTrue(errors.keySet().containsAll(List.of("pokój 1: title", "pokój 1: flag", "pokój 2: title", "pokój 3: title", "pokój 4: difficulty")));
        assertTrue(errors.get("pokój 1: title").contains("bazie")); assertTrue(errors.get("pokój 3: title").contains("pliku"));
        assertEquals(originals, jdbcTemplate.queryForList("SELECT * FROM rooms WHERE id IN (?, ?) ORDER BY id", publishedId, draftId));
    }

    @Test
    void allowsAPathRoomTitleAndRequiresUniqueTitlesOnlyAmongCtfRooms() throws Exception {
        var admin = account(Role.ADMIN); String title = uniqueTitle("Path title"); createRoom(admin, title, "PATH");
        var doc = document(); room(doc, 0).put("title", " " + title + " "); room(doc, 1).putNull("shortDescription");
        upload(admin, doc.toString(), 201);
        assertEquals(2, jdbcTemplate.queryForObject("SELECT count(*) FROM rooms WHERE title = ?", Integer.class, title));
    }

    @Test
    void rejectsPointsTasksIdsAndPublicationInsteadOfSilentlyIgnoringThem() throws Exception {
        var admin = account(Role.ADMIN); var doc = document();
        room(doc, 0).put("points", 999).put("roomType", "PATH").put("id", 1).put("published", true).putArray("tasks");
        room(doc, 1).put("title", " Tutorial VPN "); room(doc, 2).put("title", "TUTORIAL VM");
        var errors = reject(admin, doc);
        for (String field : List.of("points", "roomType", "id", "published", "tasks")) assertEquals("Nieznane pole", errors.get("pokój 1: " + field));
        assertTrue(errors.get("pokój 2: title").contains("samouczka")); assertTrue(errors.get("pokój 3: title").contains("samouczka"));
    }

    @Test
    void collectsShapeTypeAndLengthErrorsForEveryRoom() throws Exception {
        var admin = account(Role.ADMIN); var doc = document();
        doc.put("extra", true); room(doc, 0).put("title", "").put("description", "x".repeat(20001)).put("flag", 7).put("requiresVpn", "false");
        room(doc, 1).put("category", "").put("shortDescription", "x".repeat(101));
        room(doc, 2).putArray("hints").addNull().add("").add("x".repeat(2001));
        room(doc, 3).putNull("hints"); ((ArrayNode) doc.path("rooms")).addNull();
        var errors = reject(admin, doc);
        assertTrue(errors.keySet().containsAll(List.of("plik: extra", "pokój 1: title", "pokój 1: description", "pokój 1: flag", "pokój 1: requiresVpn", "pokój 2: category", "pokój 2: shortDescription", "pokój 3, podpowiedź 1", "pokój 3, podpowiedź 2", "pokój 3, podpowiedź 3", "pokój 4: hints", "pokój 5")));
        reject(admin, json.createObjectNode().put("rooms", "invalid")); reject(admin, json.createObjectNode().set("rooms", json.createArrayNode()));
    }

    @Test
    void enforcesBatchAndHintLimitsWithoutSavingAnything() throws Exception {
        var admin = account(Role.ADMIN); var doc = document(); var list = (ArrayNode) doc.path("rooms");
        var template = room(doc, 0).deepCopy(); for (int i = 0; i < 497; i++) list.add(template.deepCopy().put("title", "Overflow " + i));
        assertTrue(reject(admin, doc).containsKey("plik: rooms"));
        doc = document(); var hints = room(doc, 0).putArray("hints"); for (int i = 0; i < 101; i++) hints.add("Hint");
        assertTrue(reject(admin, doc).containsKey("pokój 1: hints"));
    }

    @Test
    void rejectsInvalidJsonDuplicatesTrailingTokensEmptyAndOversizedFiles() throws Exception {
        var admin = account(Role.ADMIN); String valid = document().toString(); var before = counts();
        String duplicated = valid.replaceFirst("\\{", "{\"rooms\":[],");
        for (String bad : List.of("", " ", "{", "null", "[]", valid + " {}", duplicated, "x".repeat(ContentImportReader.MAX_BYTES + 1))) upload(admin, bad, 400);
        assertEquals(before, counts());
    }

    @Test
    void onlyAdminsCanImportCtfRooms() throws Exception {
        var before = counts();
        for (Role role : List.of(Role.EXPERT, Role.USER)) upload(account(role), document().toString(), 403);
        mockMvc.perform(multipart("/api/admin/content/ctf/import").file(file(document().toString()))).andExpect(status().isForbidden());
        assertEquals(before, counts());
    }

    @Test
    void rollsBackEarlierRoomsAndHintsWhenALaterRoomFails() throws Exception {
        var before = counts(); var calls = new AtomicInteger();
        doAnswer(invocation -> { if (calls.incrementAndGet() == 2) throw new IOException("Second CTF room failed"); return invocation.callRealMethod(); })
                .when(roomService).createRoom(any(CreateRoomRequest.class), isNull());
        assertThrows(IOException.class, () -> importer.importRooms(file(document().toString())));
        assertEquals(2, calls.get()); assertEquals(before, counts());
    }

    @Test
    void aTitleCreatedAfterPreflightReturnsConflictAndRollsBackTheBatch() throws Exception {
        var admin = account(Role.ADMIN); var doc = document(); String first = room(doc, 0).path("title").asText(), collision = room(doc, 1).path("title").asText();
        var before = counts(); var calls = new AtomicInteger();
        doAnswer(invocation -> {
            if (calls.incrementAndGet() == 2) {
                var tx = new TransactionTemplate(transactionManager); tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
                tx.executeWithoutResult(status -> jdbcTemplate.update("""
                        INSERT INTO rooms (title, description, difficulty, category, points, flag, solutions_count, requires_vpn, room_type, created_at, updated_at, published)
                        VALUES (?, 'Concurrent', 'EASY', 'Web', 50, 'f', 0, false, 'CTF', now(), now(), false)
                        """, collision));
            }
            return invocation.callRealMethod();
        }).when(roomService).createRoom(any(CreateRoomRequest.class), isNull());
        upload(admin, doc.toString(), 409);
        assertEquals(0, jdbcTemplate.queryForObject("SELECT count(*) FROM rooms WHERE title = ?", Integer.class, first));
        assertEquals(before.get("hints"), counts().get("hints")); assertEquals(before.get("rooms") + 1, counts().get("rooms"));
    }
}
