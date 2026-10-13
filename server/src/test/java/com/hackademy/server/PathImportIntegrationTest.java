package com.hackademy.server;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hackademy.server.content.PathImportService;
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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PathImportIntegrationTest extends PostgresIntegrationTest {
    private final ObjectMapper json = new ObjectMapper();
    @Autowired private PathImportService importer;
    @MockitoSpyBean private RoomService roomService;

    private ObjectNode document() throws IOException {
        return (ObjectNode) json.readTree(Files.readString(Path.of("../client/src/data/path-import-example.json")));
    }

    private ObjectNode room(ObjectNode document, int index) {
        return (ObjectNode) document.path("chapters").get(0).path("rooms").get(index);
    }

    private MockMultipartFile file(String content) {
        return new MockMultipartFile("file", "path.json", "application/json", content.getBytes(StandardCharsets.UTF_8));
    }

    private String upload(Account account, String content, int expected) throws Exception {
        return mockMvc.perform(multipart("/api/admin/content/paths/import").file(file(content))
                .header("Authorization", "Bearer " + account.token())).andExpect(status().is(expected))
                .andReturn().getResponse().getContentAsString();
    }

    private Map<String, Long> counts() {
        var result = new LinkedHashMap<String, Long>();
        for (String table : List.of("paths", "path_chapters", "rooms", "hints", "room_tasks", "chapter_rooms")) {
            result.put(table, jdbcTemplate.queryForObject("SELECT count(*) FROM " + table, Long.class));
        }
        return result;
    }

    private Map<String, String> reject(Account admin, ObjectNode doc) throws Exception {
        var before = counts();
        String result = upload(admin, doc.toString(), 400);
        assertEquals(before, counts());
        return JsonPath.read(result, "$.fields");
    }

    @Test
    void importsTheDownloadableExampleAsOrderedDraftsWithTasksHintsAndUnlockMode() throws Exception {
        var admin = account(Role.ADMIN);
        var doc = document();
        var second = ((ArrayNode) doc.path("chapters")).addObject();
        second.put("title", "Powtórka");
        second.putArray("rooms").add(room(doc, 1).deepCopy());
        room(doc, 0).put("requiresVpn", true);
        ((ObjectNode) room(doc, 0).path("tasks").get(0)).put("content", "<script>alert(1)</script><p>Materiał</p>");
        String response = upload(admin, doc.toString(), 201);
        long id = ((Number) JsonPath.read(response, "$.id")).longValue();
        assertEquals("ROOM", JsonPath.read(response, "$.unlockMode"));
        assertEquals(false, JsonPath.read(response, "$.published"));
        assertEquals(List.of("Pierwsze kroki", "Powtórka"), JsonPath.read(response, "$.chapters[*].title"));
        var rows = jdbcTemplate.queryForList("""
                SELECT r.id, r.title, r.published, r.room_type, r.points, r.requires_vpn, cr.sort_order
                FROM rooms r JOIN chapter_rooms cr ON cr.room_id = r.id
                JOIN path_chapters c ON c.id = cr.chapter_id WHERE c.path_id = ? ORDER BY c.sort_order, cr.sort_order
                """, id);
        assertEquals(List.of("Terminal", "Znajdź flagę", "Znajdź flagę"), rows.stream().map(r -> r.get("title")).toList());
        assertTrue(rows.stream().allMatch(r -> r.get("published").equals(false) && r.get("room_type").equals("PATH") && r.get("points").equals(30)));
        long first = ((Number) rows.get(0).get("id")).longValue();
        assertEquals(true, rows.get(0).get("requires_vpn"));
        assertEquals("<p>Materiał</p>", jdbcTemplate.queryForObject("SELECT content FROM room_tasks WHERE room_id = ?", String.class, first));
        assertEquals("pwd", jdbcTemplate.queryForObject("SELECT answer FROM room_tasks WHERE room_id = ?", String.class, first));
        assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM hints WHERE room_id = ?", Integer.class, first));
        assertNull(jdbcTemplate.queryForObject("SELECT banner_url FROM paths WHERE id = ?", String.class, id));
        getAs(admin, "/api/admin/content/rooms/" + first).andExpect(status().isOk());
    }

    @Test
    void defaultsOptionalValuesAndAcceptsEachUnlockMode() throws Exception {
        var admin = account(Role.ADMIN);
        for (String mode : List.of("OPEN", "CHAPTER", "ROOM", "missing")) {
            var doc = document();
            if (mode.equals("missing")) doc.remove("unlockMode"); else doc.put("unlockMode", mode);
            room(doc, 1).putNull("shortDescription");
            String response = upload(admin, doc.toString(), 201);
            assertEquals(mode.equals("missing") ? "OPEN" : mode, JsonPath.read(response, "$.unlockMode"));
        }
    }

    @Test
    void returnsAllSemanticErrorsWithChapterRoomAndTaskLocations() throws Exception {
        var admin = account(Role.ADMIN);
        var doc = document();
        doc.put("title", ""); doc.put("description", "x".repeat(20001)); doc.put("unlockMode", "UNKNOWN");
        room(doc, 0).put("title", " tutorial vm ").put("difficulty", "UNKNOWN").put("points", -1).put("requiresVpn", "false");
        room(doc, 0).put("category", " ").put("shortDescription", "x".repeat(101));
        ((ArrayNode) room(doc, 0).path("hints")).add(1).add("").add("x".repeat(2001));
        var task = (ObjectNode) room(doc, 0).path("tasks").get(0);
        task.put("title", "").put("content", "<script>bad()</script>").put("answer", "");
        ((ArrayNode) room(doc, 0).path("tasks")).addObject().put("title", "A").put("content", "B").put("answer", "orphan");
        room(doc, 1).remove("flag"); room(doc, 1).put("description", "");
        var errors = reject(admin, doc);
        for (String key : List.of("ścieżka: title", "ścieżka: description", "ścieżka: unlockMode", "rozdział 1, pokój 1: title", "rozdział 1, pokój 1: difficulty", "rozdział 1, pokój 1: points", "rozdział 1, pokój 1: requiresVpn", "rozdział 1, pokój 1: category", "rozdział 1, pokój 1: shortDescription", "rozdział 1, pokój 1, podpowiedź 2", "rozdział 1, pokój 1, zadanie 1: content", "rozdział 1, pokój 1, zadanie 1: answer", "rozdział 1, pokój 1, zadanie 2: question", "rozdział 1, pokój 2: flag", "rozdział 1, pokój 2: description")) assertTrue(errors.containsKey(key), key);
    }

    @Test
    void rejectsUnknownFieldsWrongTypesNullElementsAndDuplicateChapterRoomTitles() throws Exception {
        var admin = account(Role.ADMIN);
        var doc = document();
        doc.put("published", true); doc.put("bannerUrl", "https://example.com/a.png");
        room(doc, 0).put("id", 9).put("title", "Same").put("points", "30");
        room(doc, 1).put("title", " Same ").putNull("tasks").put("hints", "not an array").put("category", 1);
        ((ArrayNode) room(doc, 0).path("tasks")).addNull();
        ((ArrayNode) doc.path("chapters")).addNull();
        ((ArrayNode) doc.path("chapters").get(0).path("rooms")).addNull();
        var errors = reject(admin, doc);
        assertTrue(errors.containsKey("plik: published"));
        assertTrue(errors.containsKey("rozdział 1, pokój 1: id"));
        assertTrue(errors.containsKey("rozdział 1, pokój 2: title"));
        assertTrue(errors.containsKey("rozdział 2"));
        assertTrue(errors.containsKey("rozdział 1, pokój 3"));
        assertTrue(errors.containsKey("rozdział 1, pokój 1, zadanie 2"));
        assertTrue(errors.containsKey("rozdział 1, pokój 2: category"));
        assertTrue(errors.containsKey("rozdział 1, pokój 2: hints"));
    }

    @Test
    void enforcesListAndNumericLimits() throws Exception {
        var admin = account(Role.ADMIN);
        var doc = document();
        var chapters = (ArrayNode) doc.path("chapters");
        var chapter = chapters.get(0).deepCopy();
        for (int i = 0; i < 100; i++) chapters.add(chapter.deepCopy());
        assertTrue(reject(admin, doc).containsKey("ścieżka: chapters"));
        doc = document();
        var rooms = (ArrayNode) doc.path("chapters").get(0).path("rooms");
        var template = room(doc, 1).deepCopy();
        for (int i = 0; i < 499; i++) rooms.add(template.deepCopy().put("title", "R" + i));
        assertTrue(reject(admin, doc).containsKey("rozdział 1: rooms"));
        doc = document();
        room(doc, 0).put("points", 2147483648L);
        var hints = (ArrayNode) room(doc, 0).path("hints");
        var tasks = (ArrayNode) room(doc, 0).path("tasks");
        var task = tasks.get(0).deepCopy();
        for (int i = 0; i < 100; i++) { hints.add("Hint"); tasks.add(task.deepCopy()); }
        var errors = reject(admin, doc);
        assertTrue(errors.containsKey("rozdział 1, pokój 1: points"));
        assertTrue(errors.containsKey("rozdział 1, pokój 1: hints"));
        assertTrue(errors.containsKey("rozdział 1, pokój 1: tasks"));
        doc = document(); ((ArrayNode) doc.path("chapters")).removeAll();
        assertTrue(reject(admin, doc).containsKey("ścieżka: chapters"));
        doc = document(); ((ObjectNode) doc.path("chapters").get(0)).put("rooms", 1);
        assertTrue(reject(admin, doc).containsKey("rozdział 1: rooms"));
    }

    @Test
    void rejectsInvalidJsonEmptyOversizedAndMultipleDocumentsWithoutSaving() throws Exception {
        var admin = account(Role.ADMIN);
        var before = counts();
        for (String bad : List.of("", " ", "{", "[]", "null", "{} {}", "{\"title\":\"a\",\"title\":\"b\"}", "x".repeat(PathImportService.MAX_BYTES + 1))) upload(admin, bad, 400);
        assertEquals(before, counts());
    }

    @Test
    void onlyAdminsCanImport() throws Exception {
        var before = counts();
        for (Role role : List.of(Role.EXPERT, Role.USER)) upload(account(role), document().toString(), 403);
        mockMvc.perform(multipart("/api/admin/content/paths/import").file(file(document().toString())))
                .andExpect(status().isForbidden());
        assertEquals(before, counts());
    }

    @Test
    void rollsBackAllCreatedMaterialsWhenALaterRoomFailsDuringPersistence() throws Exception {
        var before = counts();
        var calls = new AtomicInteger();
        doAnswer(invocation -> {
            if (calls.incrementAndGet() == 2) throw new IOException("Forced failure in the second room");
            return invocation.callRealMethod();
        }).when(roomService).createRoom(any(CreateRoomRequest.class), isNull());
        assertThrows(IOException.class, () -> importer.importPath(file(document().toString())));
        assertEquals(2, calls.get());
        assertEquals(before, counts());
    }
}
