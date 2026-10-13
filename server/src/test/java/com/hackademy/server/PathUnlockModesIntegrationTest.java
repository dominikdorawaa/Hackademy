package com.hackademy.server;

import com.fasterxml.jackson.databind.ObjectMapper;
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

class PathUnlockModesIntegrationTest extends PostgresIntegrationTest {
    private final ObjectMapper mapper = new ObjectMapper();

    private Map<String, Object> chapter(String title, List<Long> roomIds) {
        var chapter = new LinkedHashMap<String, Object>();
        chapter.put("title", title); chapter.put("roomIds", roomIds);
        return chapter;
    }

    private Map<String, Object> path(String unlockMode, List<Map<String, Object>> chapters) {
        var path = new LinkedHashMap<String, Object>();
        path.put("title", uniqueTitle("Unlock path")); path.put("description", "Opis"); path.put("bannerUrl", null);
        path.put("published", true); path.put("revision", 0); path.put("chaptersRevision", 0); path.put("chapters", chapters);
        if (unlockMode != null) path.put("unlockMode", unlockMode);
        return path;
    }

    private ResultActions savePath(Account admin, Long id, Map<String, Object> data) throws Exception {
        var part = new MockMultipartFile("content", "", MediaType.APPLICATION_JSON_VALUE, mapper.writeValueAsBytes(data));
        var request = id == null ? multipart("/api/admin/content/paths") : multipart(HttpMethod.PUT, "/api/admin/content/paths/" + id);
        return mockMvc.perform(request.file(part).header("Authorization", "Bearer " + admin.token()));
    }

    private long createPath(Account admin, String unlockMode, List<Map<String, Object>> chapters) throws Exception {
        String body = savePath(admin, null, path(unlockMode, chapters)).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    private void changeMode(Account admin, long pathId, String unlockMode) throws Exception {
        String detail = getAs(admin, "/api/admin/paths/" + pathId).andReturn().getResponse().getContentAsString();
        var data = path(unlockMode, JsonPath.read(detail, "$.chapters"));
        data.put("title", JsonPath.read(detail, "$.title"));
        data.put("revision", JsonPath.read(detail, "$.contentRevision"));
        data.put("chaptersRevision", JsonPath.read(detail, "$.revision"));
        savePath(admin, pathId, data).andExpect(status().isOk()).andExpect(jsonPath("$.unlockMode").value(unlockMode));
    }

    private long room(Account admin) throws Exception {
        return createRoom(admin, uniqueTitle("Unlock room"), "PATH");
    }

    private Account learner(long pathId) throws Exception {
        var user = account(Role.USER);
        mockMvc.perform(post("/api/paths/" + pathId + "/enroll").header("Authorization", "Bearer " + user.token()))
                .andExpect(status().isOk());
        return user;
    }

    private ResultActions solve(Account user, long roomId) throws Exception {
        return postJson(user, "/api/rooms/" + roomId + "/solve", "{\"flag\":\"flag\"}");
    }

    private List<Boolean> roomLocks(Account user, long pathId) throws Exception {
        return JsonPath.read(getAs(user, "/api/paths/" + pathId).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(), "$.rooms[*].locked");
    }

    private List<Boolean> chapterLocks(Account user, long pathId) throws Exception {
        return JsonPath.read(getAs(user, "/api/paths/" + pathId).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(), "$.chapters[*].locked");
    }

    @Test
    void pathsDefaultToOpenAndKeepEveryRoomAvailable() throws Exception {
        var admin = account(Role.ADMIN);
        long first = room(admin), second = room(admin);
        long pathId = createPath(admin, null, List.of(chapter("A", List.of(first)), chapter("B", List.of(second))));
        getAs(admin, "/api/admin/paths/" + pathId).andExpect(jsonPath("$.unlockMode").value("OPEN"));
        assertEquals("OPEN", jdbcTemplate.queryForObject("SELECT unlock_mode FROM paths WHERE id = ?", String.class, pathId));
        long legacy = ((Number) JsonPath.read(postJson(admin, "/api/admin/paths", """
                {"title":"%s","description":"d","roomIds":[]}
                """.formatted(uniqueTitle("Legacy"))).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "$.id")).longValue();
        getAs(admin, "/api/admin/paths/" + legacy).andExpect(jsonPath("$.unlockMode").value("OPEN"));

        var user = learner(pathId);
        getAs(user, "/api/paths/" + pathId).andExpect(jsonPath("$.unlockMode").value("OPEN"));
        assertEquals(List.of(false, false), roomLocks(user, pathId));
        assertEquals(List.of(false, false), chapterLocks(user, pathId));
        getAs(user, "/api/rooms/" + second).andExpect(status().isOk());
        solve(user, second).andExpect(status().isOk());
    }

    @Test
    void chapterModeOpensNextChapterAfterPreviousIsComplete() throws Exception {
        var admin = account(Role.ADMIN);
        long a1 = room(admin), a2 = room(admin), hidden = room(admin), b1 = room(admin), c1 = room(admin);
        long pathId = createPath(admin, "CHAPTER", List.of(chapter("A", List.of(a1, a2)), chapter("Hidden", List.of(hidden)),
                chapter("B", List.of(b1)), chapter("C", List.of(c1))));
        jdbcTemplate.update("UPDATE rooms SET published = false WHERE id = ?", hidden);
        var user = learner(pathId);

        assertEquals(List.of(false, false, true, true), roomLocks(user, pathId));
        assertEquals(List.of(false, false, true, true), chapterLocks(user, pathId));
        getAs(user, "/api/rooms/" + a2).andExpect(status().isOk());
        getAs(user, "/api/rooms/" + b1).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message", containsString("rozdział")));
        solve(user, b1).andExpect(status().isForbidden());
        assertEquals(0, jdbcTemplate.queryForObject("SELECT count(*) FROM user_solved_rooms WHERE user_id = ?", Integer.class, user.id()));

        solve(user, a2).andExpect(status().isOk());
        assertEquals(List.of(false, false, true, true), roomLocks(user, pathId));
        solve(user, a1).andExpect(status().isOk());
        assertEquals(List.of(false, false, false, true), roomLocks(user, pathId));
        assertEquals(List.of(false, false, false, true), chapterLocks(user, pathId));
        getAs(user, "/api/rooms/" + b1).andExpect(status().isOk());
        getAs(user, "/api/rooms/" + c1).andExpect(status().isForbidden());
        solve(user, b1).andExpect(status().isOk());
        assertEquals(List.of(false, false, false, false), roomLocks(user, pathId));
    }

    @Test
    void roomModeIsOneQueueAcrossChaptersAndGuardsEveryRoomAction() throws Exception {
        var admin = account(Role.ADMIN);
        long a1 = room(admin), a2 = room(admin), b1 = room(admin);
        jdbcTemplate.update("INSERT INTO hints (description, room_id) VALUES ('Hint', ?)", b1);
        long hint = jdbcTemplate.queryForObject("SELECT id FROM hints WHERE room_id = ?", Long.class, b1);
        long pathId = createPath(admin, "ROOM", List.of(chapter("A", List.of(a1, a2)), chapter("B", List.of(b1))));
        var user = learner(pathId);

        assertEquals(List.of(false, true, true), roomLocks(user, pathId));
        assertEquals(List.of(false, true), chapterLocks(user, pathId));
        getAs(user, "/api/paths/" + pathId + "/rooms-mini?limit=0")
                .andExpect(jsonPath("$.rooms[*].locked").value(contains(false, true, true)));
        getAs(user, "/api/rooms/" + a2).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message", containsString("pokoje")));
        getAs(user, "/api/rooms/" + b1 + "/file").andExpect(status().isForbidden());
        postJson(user, "/api/rooms/" + b1 + "/hints/" + hint + "/unlock", "{}").andExpect(status().isForbidden());
        postJson(user, "/api/rooms/" + b1 + "/tasks/complete", "{}").andExpect(status().isForbidden());
        assertEquals(0, jdbcTemplate.queryForObject("SELECT count(*) FROM user_unlocked_hints WHERE user_id = ?", Integer.class, user.id()));

        solve(user, a1).andExpect(status().isOk());
        assertEquals(List.of(false, false, true), roomLocks(user, pathId));
        assertEquals(List.of(false, true), chapterLocks(user, pathId));
        solve(user, b1).andExpect(status().isForbidden());
        solve(user, a2).andExpect(status().isOk());
        assertEquals(List.of(false, false, false), roomLocks(user, pathId));
        assertEquals(List.of(false, false), chapterLocks(user, pathId));
        postJson(user, "/api/rooms/" + b1 + "/hints/" + hint + "/unlock", "{}").andExpect(status().isOk());
        getAs(user, "/api/rooms/" + b1).andExpect(status().isOk());
    }

    @Test
    void locksAreComputedLiveFromModeProgressAndPublishedRooms() throws Exception {
        var admin = account(Role.ADMIN);
        long first = room(admin), second = room(admin), third = room(admin);
        long pathId = createPath(admin, null, List.of(chapter("A", List.of(first, second)), chapter("B", List.of(third))));
        var user = learner(pathId);
        solve(user, third).andExpect(status().isOk());

        changeMode(admin, pathId, "ROOM");
        assertEquals(List.of(false, true, false), roomLocks(user, pathId));
        getAs(user, "/api/rooms/" + third).andExpect(status().isOk());
        solve(user, third).andExpect(status().isOk());
        getAs(user, "/api/rooms/" + second).andExpect(status().isForbidden());

        jdbcTemplate.update("UPDATE rooms SET published = false WHERE id = ?", first);
        getAs(user, "/api/rooms/" + second).andExpect(status().isOk());
        jdbcTemplate.update("UPDATE rooms SET published = true WHERE id = ?", first);
        getAs(user, "/api/rooms/" + second).andExpect(status().isForbidden());

        changeMode(admin, pathId, "CHAPTER");
        assertEquals(List.of(false, false, false), roomLocks(user, pathId));
        assertEquals(List.of(false, false), chapterLocks(user, pathId));
        changeMode(admin, pathId, "OPEN");
        getAs(user, "/api/rooms/" + second).andExpect(status().isOk());
    }

    @Test
    void tutorialLocksStillApplyToOpenPathRooms() throws Exception {
        var admin = account(Role.ADMIN);
        long vpnRoom = room(admin), next = room(admin);
        jdbcTemplate.update("UPDATE rooms SET requires_vpn = true WHERE id = ?", vpnRoom);
        long pathId = createPath(admin, "ROOM", List.of(chapter("A", List.of(vpnRoom, next))));
        var user = learner(pathId);

        assertEquals(List.of(true, true), roomLocks(user, pathId));
        getAs(user, "/api/paths/" + pathId + "/rooms-mini?limit=0")
                .andExpect(jsonPath("$.rooms[*].locked").value(contains(true, true)));
    }

    @Test
    void rejectsUnknownModeAndKeepsModeWhenOmittedOnUpdate() throws Exception {
        var admin = account(Role.ADMIN);
        long first = room(admin);
        savePath(admin, null, path("SEQUENTIAL", List.of(chapter("A", List.of(first))))).andExpect(status().isBadRequest());
        long pathId = createPath(admin, "CHAPTER", List.of(chapter("A", List.of(first))));
        changeMode(admin, pathId, "ROOM");

        String detail = getAs(admin, "/api/admin/paths/" + pathId).andReturn().getResponse().getContentAsString();
        var data = path(null, JsonPath.read(detail, "$.chapters"));
        data.put("revision", JsonPath.read(detail, "$.contentRevision"));
        data.put("chaptersRevision", JsonPath.read(detail, "$.revision"));
        savePath(admin, pathId, data).andExpect(status().isOk()).andExpect(jsonPath("$.unlockMode").value("ROOM"));
        getAs(admin, "/api/admin/content/paths/" + pathId + "/preview")
                .andExpect(jsonPath("$.unlockMode").value("ROOM"))
                .andExpect(jsonPath("$.chapters[0].locked").value(false));
    }

    @Test
    void dashboardShowsCurrentLocksAfterChapterAndRoomChanges() throws Exception {
        var admin = account(Role.ADMIN);
        long first = room(admin), second = room(admin), third = room(admin);
        jdbcTemplate.update("UPDATE paths SET published = false");
        long pathId = createPath(admin, "ROOM", List.of(chapter("A", List.of(first, second)), chapter("B", List.of(third))));
        var user = learner(pathId);
        String dashboard = "/api/dashboard/summary";
        getAs(user, dashboard).andExpect(jsonPath("$.currentPath.id").value(pathId))
                .andExpect(jsonPath("$.currentPathRoomsMini[*].id").value(contains((int) first, (int) second, (int) third)))
                .andExpect(jsonPath("$.currentPathRoomsMini[*].locked").value(contains(false, true, true)));

        String detail = getAs(admin, "/api/admin/paths/" + pathId).andReturn().getResponse().getContentAsString();
        List<Integer> chapterIds = JsonPath.read(detail, "$.chapters[*].id");
        putJson(admin, "/api/admin/paths/" + pathId + "/chapters", """
                {"revision":%d,"chapters":[{"id":%d,"title":"A","roomIds":[%d,%d]},{"id":%d,"title":"B","roomIds":[%d]}]}
                """.formatted(((Number) JsonPath.read(detail, "$.revision")).longValue(), chapterIds.get(0), second, first, chapterIds.get(1), third))
                .andExpect(status().isOk());
        getAs(user, dashboard)
                .andExpect(jsonPath("$.currentPathRoomsMini[*].id").value(contains((int) second, (int) first, (int) third)))
                .andExpect(jsonPath("$.currentPathRoomsMini[*].locked").value(contains(false, true, true)));

        mockMvc.perform(delete("/api/admin/rooms/" + second).header("Authorization", "Bearer " + admin.token()))
                .andExpect(status().is2xxSuccessful());
        getAs(user, dashboard)
                .andExpect(jsonPath("$.currentPathRoomsMini[*].id").value(contains((int) first, (int) third)))
                .andExpect(jsonPath("$.currentPathRoomsMini[*].locked").value(contains(false, true)));
    }
}
