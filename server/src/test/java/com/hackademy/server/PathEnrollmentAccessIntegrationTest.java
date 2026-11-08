package com.hackademy.server;

import tools.jackson.databind.ObjectMapper;
import com.hackademy.server.user.Role;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.ResultActions;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PathEnrollmentAccessIntegrationTest extends PostgresIntegrationTest {
    private static final String REQUIRED = "PATH_ENROLLMENT_REQUIRED";
    private final ObjectMapper mapper = new ObjectMapper();

    private long createPath(Account admin, String unlockMode, List<Long> roomIds) throws Exception {
        var chapter = new LinkedHashMap<String, Object>();
        chapter.put("title", "Rozdział"); chapter.put("roomIds", roomIds);
        var path = new LinkedHashMap<String, Object>();
        path.put("title", uniqueTitle("Enrollment path")); path.put("description", "Opis"); path.put("bannerUrl", null);
        path.put("published", true); path.put("revision", 0); path.put("chaptersRevision", 0);
        path.put("chapters", List.of(chapter)); path.put("unlockMode", unlockMode);
        var part = new MockMultipartFile("content", "", MediaType.APPLICATION_JSON_VALUE, mapper.writeValueAsBytes((Map<String, Object>) path));
        String body = mockMvc.perform(multipart("/api/admin/content/paths").file(part).header("Authorization", "Bearer " + admin.token()))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    private long room(Account admin) throws Exception {
        long room = createRoom(admin, uniqueTitle("Enrollment room"), "PATH");
        addFlagTask(room, "flag");
        return room;
    }

    private void enroll(Account user, long pathId) throws Exception {
        mockMvc.perform(post("/api/paths/" + pathId + "/enroll").header("Authorization", "Bearer " + user.token()))
                .andExpect(status().isOk());
    }

    private void expectJoinRequired(ResultActions result, long... pathIds) throws Exception {
        result.andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value(REQUIRED));
        for (int i = 0; i < pathIds.length; i++) {
            result.andExpect(jsonPath("$.pathIds[" + i + "]").value(pathIds[i]));
        }
        result.andExpect(jsonPath("$.pathIds.length()").value(pathIds.length));
    }

    private long taskOf(long room) {
        return jdbcTemplate.queryForObject("SELECT id FROM room_tasks WHERE room_id = ? ORDER BY id LIMIT 1", Long.class, room);
    }

    @Test
    void aDirectLinkDoesNotBypassJoiningThePath() throws Exception {
        var admin = account(Role.ADMIN);
        long room = room(admin);
        long path = createPath(admin, "OPEN", List.of(room));
        long hint = addHint(room, "Tajemnica");
        var user = account(Role.USER);

        expectJoinRequired(getAs(user, "/api/rooms/" + room), path);
        expectJoinRequired(getAs(user, "/api/rooms/" + room + "/file"), path);
        expectJoinRequired(postJson(user, "/api/rooms/" + room + "/hints/" + hint + "/unlock", "{}"), path);
        expectJoinRequired(postJson(user, "/api/rooms/" + room + "/tasks/" + taskOf(room) + "/solve", "{\"answer\":\"flag\"}"), path);
        expectJoinRequired(postJson(user, "/api/rooms/" + room + "/tasks/complete", "{}"), path);
        org.junit.jupiter.api.Assertions.assertEquals(0, jdbcTemplate.queryForObject(
                "SELECT count(*) FROM user_completed_tasks WHERE user_id = ?", Integer.class, user.id()));
        org.junit.jupiter.api.Assertions.assertEquals(0, jdbcTemplate.queryForObject(
                "SELECT count(*) FROM user_unlocked_hints WHERE user_id = ?", Integer.class, user.id()));

        enroll(user, path);
        getAs(user, "/api/rooms/" + room).andExpect(status().isOk());
        solveRoom(user, room, "flag").andExpect(status().isOk());

        mockMvc.perform(delete("/api/paths/" + path + "/enroll").header("Authorization", "Bearer " + user.token()))
                .andExpect(status().isOk());
        expectJoinRequired(getAs(user, "/api/rooms/" + room), path);
    }

    @Test
    void joiningAnyPathWithTheRoomOpensIt() throws Exception {
        var admin = account(Role.ADMIN);
        long shared = room(admin);
        long first = createPath(admin, "OPEN", List.of(shared));
        long second = createPath(admin, "OPEN", List.of(shared));
        var outsider = account(Role.USER);
        expectJoinRequired(getAs(outsider, "/api/rooms/" + shared), first, second);

        var member = account(Role.USER);
        enroll(member, second);
        getAs(member, "/api/rooms/" + shared).andExpect(status().isOk());
    }

    @Test
    void anOpenPathThePlayerDidNotJoinDoesNotUnlockARoomOfTheirPath() throws Exception {
        var admin = account(Role.ADMIN);
        long before = room(admin);
        long shared = room(admin);
        long sequential = createPath(admin, "ROOM", List.of(before, shared));
        long open = createPath(admin, "OPEN", List.of(shared));
        var user = account(Role.USER);
        enroll(user, sequential);

        getAs(user, "/api/rooms/" + shared).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").doesNotExist());
        getAs(user, "/api/paths/" + sequential).andExpect(jsonPath("$.chapters[0].rooms[1].locked").value(true));

        enroll(user, open);
        getAs(user, "/api/rooms/" + shared).andExpect(status().isOk());
        getAs(user, "/api/paths/" + sequential).andExpect(jsonPath("$.chapters[0].rooms[1].locked").value(false));
    }

    @Test
    void roomsOfAPathThePlayerDidNotJoinAreNeverOfferedAsOpen() throws Exception {
        var admin = account(Role.ADMIN);
        long room = room(admin);
        long path = createPath(admin, "OPEN", List.of(room));
        var user = account(Role.USER);

        getAs(user, "/api/paths/" + path + "/rooms-mini?limit=0").andExpect(jsonPath("$.rooms[0].locked").value(true));
        enroll(user, path);
        getAs(user, "/api/paths/" + path + "/rooms-mini?limit=0").andExpect(jsonPath("$.rooms[0].locked").value(false));
    }

    @Test
    void theDashboardFollowsJoiningAndLeavingImmediately() throws Exception {
        var admin = account(Role.ADMIN);
        long room = room(admin);
        long path = createPath(admin, "OPEN", List.of(room));
        var user = account(Role.USER);

        getAs(user, "/api/dashboard/summary").andExpect(status().isOk())
                .andExpect(jsonPath("$.currentPath").value(nullValue()))
                .andExpect(jsonPath("$.currentPathRoomsMini.length()").value(0));

        enroll(user, path);
        getAs(user, "/api/dashboard/summary").andExpect(jsonPath("$.currentPath.id").value(path))
                .andExpect(jsonPath("$.currentPathRoomsMini[*].id", contains((int) room)))
                .andExpect(jsonPath("$.currentPathRoomsMini[0].locked").value(false));

        mockMvc.perform(delete("/api/paths/" + path + "/enroll").header("Authorization", "Bearer " + user.token()))
                .andExpect(status().isOk());
        getAs(user, "/api/dashboard/summary").andExpect(jsonPath("$.currentPath").value(nullValue()));
    }
}
