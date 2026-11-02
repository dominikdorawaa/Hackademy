package com.hackademy.server;

import tools.jackson.databind.ObjectMapper;
import com.hackademy.server.user.Role;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.ResultActions;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class RoomInManyPathsIntegrationTest extends PostgresIntegrationTest {
    private final ObjectMapper mapper = new ObjectMapper();

    private Map<String, Object> chapter(String title, List<Long> roomIds) {
        var chapter = new LinkedHashMap<String, Object>();
        chapter.put("title", title); chapter.put("roomIds", roomIds);
        return chapter;
    }

    private Map<String, Object> path(String title, String unlockMode, boolean published, List<Map<String, Object>> chapters) {
        var path = new LinkedHashMap<String, Object>();
        path.put("title", title); path.put("description", "Opis"); path.put("bannerUrl", null);
        path.put("published", published); path.put("revision", 0); path.put("chaptersRevision", 0);
        path.put("chapters", chapters); path.put("unlockMode", unlockMode);
        return path;
    }

    private ResultActions savePath(Account admin, Long id, Map<String, Object> data) throws Exception {
        var part = new MockMultipartFile("content", "", MediaType.APPLICATION_JSON_VALUE, mapper.writeValueAsBytes(data));
        var request = id == null ? multipart("/api/admin/content/paths") : multipart(HttpMethod.PUT, "/api/admin/content/paths/" + id);
        return mockMvc.perform(request.file(part).header("Authorization", "Bearer " + admin.token()));
    }

    private long createPath(Account admin, String title, String unlockMode, List<Map<String, Object>> chapters) throws Exception {
        String body = savePath(admin, null, path(title, unlockMode, true, chapters)).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    private void updatePath(Account admin, long pathId, boolean published, List<Map<String, Object>> chapters) throws Exception {
        String detail = getAs(admin, "/api/admin/paths/" + pathId).andReturn().getResponse().getContentAsString();
        var data = path(JsonPath.read(detail, "$.title"), JsonPath.read(detail, "$.unlockMode"), published, chapters);
        data.put("revision", JsonPath.read(detail, "$.contentRevision"));
        data.put("chaptersRevision", JsonPath.read(detail, "$.revision"));
        savePath(admin, pathId, data).andExpect(status().isOk());
    }

    private long room(Account admin) throws Exception {
        long room = createRoom(admin, uniqueTitle("Shared room"), "PATH");
        addFlagTask(room, "flag");
        return room;
    }

    private Account learner(long... pathIds) throws Exception {
        var user = account(Role.USER);
        for (long pathId : pathIds) {
            mockMvc.perform(post("/api/paths/" + pathId + "/enroll").header("Authorization", "Bearer " + user.token()))
                    .andExpect(status().isOk());
        }
        return user;
    }

    private List<Boolean> roomLocks(Account user, long pathId) throws Exception {
        return JsonPath.read(getAs(user, "/api/paths/" + pathId).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(), "$.chapters[*].rooms[*].locked");
    }

    private List<Boolean> chapterLocks(Account user, long pathId) throws Exception {
        return JsonPath.read(getAs(user, "/api/paths/" + pathId).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(), "$.chapters[*].locked");
    }

    private int assignments(long roomId) {
        return jdbcTemplate.queryForObject("SELECT count(*) FROM chapter_rooms WHERE room_id = ?", Integer.class, roomId);
    }

    @Test
    void roomJoinsTwoPathsButOnlyOneChapterOfEach() throws Exception {
        var admin = account(Role.ADMIN);
        long shared = room(admin), other = room(admin);
        String webTitle = uniqueTitle("Web Basics"), linuxTitle = uniqueTitle("Linux 101");
        long web = createPath(admin, webTitle, "OPEN", List.of(chapter("A", List.of(shared))));
        long linux = createPath(admin, linuxTitle, "OPEN", List.of(chapter("A", List.of(other)), chapter("B", List.of(shared))));
        assertEquals(2, assignments(shared));

        var twice = path(uniqueTitle("Twice"), "OPEN", false, List.of(chapter("A", List.of(shared)), chapter("B", List.of(shared))));
        savePath(admin, null, twice).andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("rozdziale 1")));
        assertEquals(2, assignments(shared));

        String adminRooms = getAs(admin, "/api/admin/rooms").andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertEquals(List.of(linuxTitle, webTitle), JsonPath.read(adminRooms, "$[?(@.id == " + shared + ")].paths[*].title"));
        assertEquals(List.of(linuxTitle), JsonPath.read(adminRooms, "$[?(@.id == " + other + ")].paths[*].title"));
        getAs(admin, "/api/admin/content/rooms/" + shared).andExpect(status().isOk())
                .andExpect(jsonPath("$.paths[*].id").value(contains((int) linux, (int) web)))
                .andExpect(jsonPath("$.paths[0].published").value(true))
                .andExpect(jsonPath("$.pathId").isEmpty());

        updatePath(admin, linux, true, List.of(chapter("A", List.of(other))));
        assertEquals(1, assignments(shared));
        getAs(admin, "/api/admin/paths/" + web).andExpect(jsonPath("$.chapters[0].roomIds[0]").value((int) shared));
    }

    @Test
    void progressIsSharedAndXpIsAwardedOnce() throws Exception {
        var admin = account(Role.ADMIN);
        long shared = room(admin);
        long first = createPath(admin, uniqueTitle("First"), "OPEN", List.of(chapter("A", List.of(shared))));
        long second = createPath(admin, uniqueTitle("Second"), "OPEN", List.of(chapter("A", List.of(shared))));
        var user = learner(first, second);

        solveRoom(user, shared, "flag").andExpect(status().isOk());
        solveRoom(user, shared, "flag");

        getAs(user, "/api/paths/" + first).andExpect(jsonPath("$.chapters[0].rooms[0].solved").value(true));
        getAs(user, "/api/paths/" + second).andExpect(jsonPath("$.chapters[0].rooms[0].solved").value(true));
        getAs(user, "/api/paths/me/progress")
                .andExpect(jsonPath("$[?(@.id == " + first + ")].completed").value(contains(true)))
                .andExpect(jsonPath("$[?(@.id == " + second + ")].completed").value(contains(true)));
        assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM user_solved_rooms WHERE user_id = ?", Integer.class, user.id()));
        assertEquals(50, jdbcTemplate.queryForObject("SELECT points FROM users WHERE id = ?", Integer.class, user.id()));
        assertEquals(1, jdbcTemplate.queryForObject("SELECT solutions_count FROM rooms WHERE id = ?", Integer.class, shared));
    }

    @Test
    void anyPublishedPathUnlocksTheRoomEvenWhenAnotherPathLocksIt() throws Exception {
        var admin = account(Role.ADMIN);
        long intro = room(admin), shared = room(admin);
        long queue = createPath(admin, uniqueTitle("Queue"), "ROOM", List.of(chapter("A", List.of(intro, shared))));
        var user = learner(queue);
        assertEquals(List.of(false, true), roomLocks(user, queue));
        getAs(user, "/api/rooms/" + shared).andExpect(status().isForbidden());

        long open = createPath(admin, uniqueTitle("Open"), "OPEN", List.of(chapter("A", List.of(shared))));
        getAs(user, "/api/rooms/" + shared).andExpect(status().isOk());
        assertEquals(List.of(false, false), roomLocks(user, queue));
        getAs(user, "/api/paths/" + queue + "/rooms-mini?limit=0").andExpect(jsonPath("$.rooms[1].locked").value(false));

        updatePath(admin, open, false, List.of(chapter("A", List.of(shared))));
        getAs(user, "/api/rooms/" + shared).andExpect(status().isForbidden());
        assertEquals(List.of(false, true), roomLocks(user, queue));

        solveRoom(user, intro, "flag").andExpect(status().isOk());
        solveRoom(user, shared, "flag").andExpect(status().isOk());
    }

    @Test
    void chapterOpenedByAnotherPathIsNotShownAsLocked() throws Exception {
        var admin = account(Role.ADMIN);
        long intro = room(admin), shared = room(admin), later = room(admin);
        long chapters = createPath(admin, uniqueTitle("Chapters"), "CHAPTER", List.of(chapter("A", List.of(intro)),
                chapter("B", List.of(shared)), chapter("C", List.of(later))));
        var user = learner(chapters);
        assertEquals(List.of(false, true, true), chapterLocks(user, chapters));

        createPath(admin, uniqueTitle("Open"), "OPEN", List.of(chapter("A", List.of(shared))));
        assertEquals(List.of(false, false, true), chapterLocks(user, chapters));
        assertEquals(List.of(false, false, true), roomLocks(user, chapters));
    }

    @Test
    void draftPathDoesNotHideARoomOfAPublishedPath() throws Exception {
        var admin = account(Role.ADMIN);
        long shared = room(admin);
        var user = account(Role.USER);
        long draft = createPath(admin, uniqueTitle("Draft"), "OPEN", List.of(chapter("A", List.of(shared))));
        updatePath(admin, draft, false, List.of(chapter("A", List.of(shared))));
        getAs(user, "/api/rooms/" + shared).andExpect(status().isNotFound());

        long published = createPath(admin, uniqueTitle("Published"), "OPEN", List.of(chapter("A", List.of(shared))));
        getAs(user, "/api/rooms/" + shared).andExpect(status().isOk());
        getAs(user, "/api/paths/" + published).andExpect(jsonPath("$.chapters[0].rooms[0].id").value((int) shared));
    }

    @Test
    void unpinningKeepsProgressAndOtherPathsWhileDeletingRemovesEveryAssignment() throws Exception {
        var admin = account(Role.ADMIN);
        long shared = room(admin), filler = room(admin);
        long first = createPath(admin, uniqueTitle("First"), "OPEN", List.of(chapter("A", List.of(shared))));
        long second = createPath(admin, uniqueTitle("Second"), "OPEN", List.of(chapter("A", List.of(shared, filler))));
        var user = learner(first, second);
        solveRoom(user, shared, "flag").andExpect(status().isOk());

        updatePath(admin, second, true, List.of(chapter("A", List.of(filler))));
        assertEquals(1, assignments(shared));
        assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM user_solved_rooms WHERE room_id = ?", Integer.class, shared));
        getAs(user, "/api/paths/" + first).andExpect(jsonPath("$.chapters[0].rooms[0].solved").value(true));

        updatePath(admin, second, true, List.of(chapter("A", List.of(filler, shared))));
        mockMvc.perform(delete("/api/admin/rooms/" + shared).header("Authorization", "Bearer " + admin.token()))
                .andExpect(status().is2xxSuccessful());
        assertEquals(0, assignments(shared));
        getAs(admin, "/api/admin/paths/" + second).andExpect(jsonPath("$.chapters[0].roomIds").value(contains((int) filler)));
    }
}
