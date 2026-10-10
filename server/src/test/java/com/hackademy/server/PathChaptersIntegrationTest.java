package com.hackademy.server;

import com.hackademy.server.user.Role;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;

import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PathChaptersIntegrationTest extends PostgresIntegrationTest {

    @Test
    void createsPathWithFirstChapterAndManagesChapters() throws Exception {
        var admin = account(Role.ADMIN);
        long first = createRoom(admin, uniqueTitle("First"), "PATH");
        long second = createRoom(admin, uniqueTitle("Second"), "PATH");
        long third = createRoom(admin, uniqueTitle("Third"), "PATH");

        long pathId = createPath(admin, List.of(second, first));

        getAs(admin, "/api/admin/paths/" + pathId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chapters.length()").value(1))
                .andExpect(jsonPath("$.chapters[0].title").value("Rozdział 1"))
                .andExpect(jsonPath("$.chapters[0].roomIds[0]").value(second))
                .andExpect(jsonPath("$.chapters[0].roomIds[1]").value(first));

        long chapterId = chapterIds(admin, pathId).get(0);
        var response = putJson(admin, "/api/admin/paths/" + pathId + "/chapters", """
                {"chapters":[
                  {"id":null,"title":"  Podstawy  ","roomIds":[%d]},
                  {"id":%d,"title":"Rozdział główny","roomIds":[%d,%d]}
                ]}
                """.formatted(third, chapterId, first, second))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chapters.length()").value(2))
                .andExpect(jsonPath("$.chapters[0].title").value("Podstawy"))
                .andExpect(jsonPath("$.chapters[0].roomIds[0]").value(third))
                .andExpect(jsonPath("$.chapters[1].id").value(chapterId))
                .andExpect(jsonPath("$.chapters[1].title").value("Rozdział główny"))
                .andExpect(jsonPath("$.chapters[1].roomIds[0]").value(first))
                .andExpect(jsonPath("$.chapters[1].roomIds[1]").value(second))
                .andReturn();
        long newChapterId = ((Number) JsonPath.read(response.getResponse().getContentAsString(), "$.chapters[0].id")).longValue();

        var user = account(Role.USER);
        jdbcTemplate.update("INSERT INTO user_solved_rooms (user_id, room_id, solved_at) VALUES (?, ?, now())", user.id(), first);
        postJson(user, "/api/paths/" + pathId + "/enroll", "{}").andExpect(status().isOk());

        getAs(user, "/api/paths/" + pathId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enrolled").value(true))
                .andExpect(jsonPath("$.chapters[0].id").value(newChapterId))
                .andExpect(jsonPath("$.chapters[0].totalRooms").value(1))
                .andExpect(jsonPath("$.chapters[0].solvedRooms").value(0))
                .andExpect(jsonPath("$.chapters[1].totalRooms").value(2))
                .andExpect(jsonPath("$.chapters[1].solvedRooms").value(1))
                .andExpect(jsonPath("$.chapters[1].rooms[0].id").value(first))
                .andExpect(jsonPath("$.chapters[1].rooms[0].solved").value(true))
                .andExpect(jsonPath("$.rooms.length()").value(3));

        getAs(user, "/api/paths/" + pathId + "/rooms-mini?limit=0")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rooms[0].id").value(third))
                .andExpect(jsonPath("$.rooms[1].id").value(first))
                .andExpect(jsonPath("$.rooms[2].id").value(second));

        var adminRooms = getAs(admin, "/api/admin/rooms").andExpect(status().isOk()).andReturn();
        List<Number> owners = JsonPath.read(adminRooms.getResponse().getContentAsString(), "$[?(@.id == %d)].pathId".formatted(first));
        assertEquals(List.of(pathId), owners.stream().map(Number::longValue).toList());
    }

    @Test
    void showsLockedChaptersBeforeEnrollment() throws Exception {
        var admin = account(Role.ADMIN);
        long room = createRoom(admin, uniqueTitle("Locked"), "PATH");
        long pathId = createPath(admin, List.of(room));
        var user = account(Role.USER);
        jdbcTemplate.update("INSERT INTO user_solved_rooms (user_id, room_id, solved_at) VALUES (?, ?, now())", user.id(), room);

        getAs(user, "/api/paths/" + pathId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enrolled").value(false))
                .andExpect(jsonPath("$.chapters[0].rooms[0].locked").value(true))
                .andExpect(jsonPath("$.chapters[0].solvedRooms").value(0));
    }

    @Test
    void rejectsInvalidChapterStructures() throws Exception {
        var admin = account(Role.ADMIN);
        long owned = createRoom(admin, uniqueTitle("Owned"), "PATH");
        long free = createRoom(admin, uniqueTitle("Free"), "PATH");
        long ctf = createRoom(admin, uniqueTitle("Ctf"), "CTF");
        long otherPath = createPath(admin, List.of(owned));
        long pathId = createPath(admin, List.of());
        long chapterId = chapterIds(admin, pathId).get(0);
        long foreignChapter = chapterIds(admin, otherPath).get(0);

        putJson(admin, "/api/admin/paths/" + pathId + "/chapters", chapters(chapterId, "A", owned))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("należy już do ścieżki")));
        putJson(admin, "/api/admin/paths/" + pathId + "/chapters", chapters(chapterId, "A", ctf))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("nie jest pokojem ścieżki")));
        putJson(admin, "/api/admin/paths/" + pathId + "/chapters", chapters(chapterId, "A", free, free))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("więcej niż raz")));
        putJson(admin, "/api/admin/paths/" + pathId + "/chapters", chapters(chapterId, "A", 999_999))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("nie istnieje")));
        putJson(admin, "/api/admin/paths/" + pathId + "/chapters", chapters(foreignChapter, "A", free))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("nie należy do tej ścieżki")));
        putJson(admin, "/api/admin/paths/" + pathId + "/chapters", """
                {"chapters":[{"id":%d,"title":"A","roomIds":[]},{"id":%d,"title":"B","roomIds":[]}]}
                """.formatted(chapterId, chapterId))
                .andExpect(status().isBadRequest());
        putJson(admin, "/api/admin/paths/" + pathId + "/chapters", "{\"chapters\":[]}")
                .andExpect(status().isBadRequest());
        putJson(admin, "/api/admin/paths/" + pathId + "/chapters", chapters(chapterId, "   ", free))
                .andExpect(status().isBadRequest());
        putJson(admin, "/api/admin/paths/" + pathId + "/chapters", """
                {"chapters":[{"id":%d,"title":"A","roomIds":[null]}]}
                """.formatted(chapterId))
                .andExpect(status().isBadRequest());

        assertEquals(0, jdbcTemplate.queryForObject("""
                SELECT count(*) FROM chapter_rooms cr JOIN path_chapters pc ON pc.id = cr.chapter_id WHERE pc.path_id = ?
                """, Integer.class, pathId));
        assertEquals(List.of(owned), jdbcTemplate.queryForList("""
                SELECT cr.room_id FROM chapter_rooms cr JOIN path_chapters pc ON pc.id = cr.chapter_id WHERE pc.path_id = ?
                """, Long.class, otherPath));
    }

    @Test
    void letsOnlyAdminsDeleteChapters() throws Exception {
        var admin = account(Role.ADMIN);
        var expert = account(Role.EXPERT);
        var user = account(Role.USER);
        long room = createRoom(admin, uniqueTitle("Movable"), "PATH");
        long pathId = createPath(admin, List.of(room));
        long firstChapter = chapterIds(admin, pathId).get(0);

        putJson(expert, "/api/admin/paths/" + pathId + "/chapters", """
                {"chapters":[{"id":%d,"title":"Wstęp","roomIds":[]},{"id":null,"title":"Dalej","roomIds":[%d]}]}
                """.formatted(firstChapter, room))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chapters[0].title").value("Wstęp"))
                .andExpect(jsonPath("$.chapters[1].roomIds[0]").value(room));
        long secondChapter = chapterIds(admin, pathId).get(1);

        putJson(expert, "/api/admin/paths/" + pathId + "/chapters", chapters(secondChapter, "Dalej", room))
                .andExpect(status().isForbidden());
        putJson(user, "/api/admin/paths/" + pathId + "/chapters", chapters(firstChapter, "Wstęp"))
                .andExpect(status().isForbidden());

        putJson(admin, "/api/admin/paths/" + pathId + "/chapters", chapters(firstChapter, "Wstęp"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chapters.length()").value(1))
                .andExpect(jsonPath("$.chapters[0].roomIds.length()").value(0));
        assertEquals(0, jdbcTemplate.queryForObject("SELECT count(*) FROM chapter_rooms WHERE room_id = ?", Integer.class, room));
        assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM rooms WHERE id = ?", Integer.class, room));
    }

    @Test
    void keepsRoomsInPathsWhenTheirTypeWouldChange() throws Exception {
        var admin = account(Role.ADMIN);
        String title = uniqueTitle("Typed");
        long room = createRoom(admin, title, "PATH");
        createPath(admin, List.of(room));

        var roomPart = new MockMultipartFile("room", "", MediaType.APPLICATION_JSON_VALUE, """
                {"title":"%s","description":"d","difficulty":"EASY","category":"Web","points":50,"flag":"f","requiresVpn":false,"roomType":"CTF","hints":[]}
                """.formatted(title).getBytes(StandardCharsets.UTF_8));
        mockMvc.perform(multipart(HttpMethod.PUT, "/api/admin/rooms/" + room)
                        .file(roomPart)
                        .header("Authorization", "Bearer " + admin.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Usuń go z rozdziału")));
        assertEquals("PATH", jdbcTemplate.queryForObject("SELECT room_type FROM rooms WHERE id = ?", String.class, room));
    }

    @Test
    void removesChaptersAndAssignmentsWithTheirPath() throws Exception {
        var admin = account(Role.ADMIN);
        long room = createRoom(admin, uniqueTitle("Cascade"), "PATH");
        long pathId = createPath(admin, List.of(room));

        mockMvc.perform(delete("/api/admin/paths/" + pathId)
                        .header("Authorization", "Bearer " + admin.token()))
                .andExpect(status().isNoContent());

        assertEquals(0, jdbcTemplate.queryForObject("SELECT count(*) FROM path_chapters WHERE path_id = ?", Integer.class, pathId));
        assertEquals(0, jdbcTemplate.queryForObject("SELECT count(*) FROM chapter_rooms WHERE room_id = ?", Integer.class, room));
        long nextPath = createPath(admin, List.of(room));
        assertEquals(List.of(room), jdbcTemplate.queryForList("""
                SELECT cr.room_id FROM chapter_rooms cr JOIN path_chapters pc ON pc.id = cr.chapter_id WHERE pc.path_id = ?
                """, Long.class, nextPath));
    }

    private long createPath(Account admin, List<Long> roomIds) throws Exception {
        var result = postJson(admin, "/api/admin/paths", """
                {"title":"%s","description":"opis","bannerUrl":null,"roomIds":%s}
                """.formatted(uniqueTitle("Path"), roomIds))
                .andExpect(status().isCreated())
                .andReturn();
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id")).longValue();
    }

    private List<Long> chapterIds(Account admin, long pathId) throws Exception {
        var result = getAs(admin, "/api/admin/paths/" + pathId).andExpect(status().isOk()).andReturn();
        List<Number> ids = JsonPath.read(result.getResponse().getContentAsString(), "$.chapters[*].id");
        return ids.stream().map(Number::longValue).toList();
    }

    private String chapters(long chapterId, String title, long... roomIds) {
        return """
                {"chapters":[{"id":%d,"title":"%s","roomIds":%s}]}
                """.formatted(chapterId, title, Arrays.toString(roomIds));
    }
}
