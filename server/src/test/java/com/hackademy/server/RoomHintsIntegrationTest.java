package com.hackademy.server;

import tools.jackson.databind.ObjectMapper;
import com.hackademy.server.user.Role;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.ResultActions;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class RoomHintsIntegrationTest extends PostgresIntegrationTest {
    private final ObjectMapper mapper = new ObjectMapper();

    private long roomWithHints(Account admin, String roomType, String... descriptions) throws Exception {
        long id = createRoom(admin, uniqueTitle("Hint room"), roomType);
        for (String description : descriptions) {
            jdbcTemplate.update("INSERT INTO hints (description, room_id) VALUES (?, ?)", description, id);
        }
        return id;
    }

    private List<Long> hintIds(long roomId) {
        return jdbcTemplate.queryForList("SELECT id FROM hints WHERE room_id = ? ORDER BY id", Long.class, roomId);
    }

    private ResultActions unlock(Account user, long roomId, long hintId) throws Exception {
        return postJson(user, "/api/rooms/" + roomId + "/hints/" + hintId + "/unlock", "{}");
    }

    private int unlockedRows(Account user) {
        return jdbcTemplate.queryForObject("SELECT count(*) FROM user_unlocked_hints WHERE user_id = ?", Integer.class, user.id());
    }

    private long createPath(Account admin, String unlockMode, List<Long> roomIds) throws Exception {
        var chapter = new LinkedHashMap<String, Object>();
        chapter.put("title", "Rozdział"); chapter.put("roomIds", roomIds);
        var path = new LinkedHashMap<String, Object>();
        path.put("title", uniqueTitle("Hint path")); path.put("description", "Opis"); path.put("bannerUrl", null);
        path.put("published", true); path.put("revision", 0); path.put("chaptersRevision", 0);
        path.put("chapters", List.of(chapter)); path.put("unlockMode", unlockMode);
        var part = new MockMultipartFile("content", "", MediaType.APPLICATION_JSON_VALUE, mapper.writeValueAsBytes(path));
        String body = mockMvc.perform(multipart("/api/admin/content/paths").file(part).header("Authorization", "Bearer " + admin.token()))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    @Test
    void lockedHintsCarryOnlyIdAndOrderUntilUnlockedOnceWithPenalty() throws Exception {
        var admin = account(Role.ADMIN);
        long roomId = roomWithHints(admin, "CTF", "Pierwsza tajemnica", "Druga tajemnica");
        List<Long> hints = hintIds(roomId);
        var user = account(Role.USER);

        String locked = getAs(user, "/api/rooms/" + roomId).andExpect(status().isOk())
                .andExpect(jsonPath("$.hints[0].id").value(hints.get(0)))
                .andExpect(jsonPath("$.hints[0].order").value(0))
                .andExpect(jsonPath("$.hints[0].description").doesNotExist())
                .andExpect(jsonPath("$.hints[1].order").value(1))
                .andExpect(jsonPath("$.hints[1].description").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        assertEquals(-1, locked.indexOf("tajemnica"));

        unlock(user, roomId, hints.get(0)).andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(hints.get(0)))
                .andExpect(jsonPath("$.order").value(0))
                .andExpect(jsonPath("$.description").value("Pierwsza tajemnica"));
        unlock(user, roomId, hints.get(0)).andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("Pierwsza tajemnica"));
        assertEquals(1, unlockedRows(user));

        getAs(user, "/api/rooms/" + roomId).andExpect(status().isOk())
                .andExpect(jsonPath("$.hints[0].description").value("Pierwsza tajemnica"))
                .andExpect(jsonPath("$.hints[1].description").doesNotExist())
                .andExpect(jsonPath("$.unlockedHintIds[0]").value(hints.get(0)));

        postJson(user, "/api/rooms/" + roomId + "/solve", "{\"flag\":\"flag\"}").andExpect(status().isOk())
                .andExpect(jsonPath("$.pointsEarned").value(37));
    }

    @Test
    void unlockRejectsSkippedForeignAndUnknownHints() throws Exception {
        var admin = account(Role.ADMIN);
        long roomId = roomWithHints(admin, "CTF", "A", "B");
        long otherRoomId = roomWithHints(admin, "CTF", "Obca");
        List<Long> hints = hintIds(roomId);
        var user = account(Role.USER);

        unlock(user, roomId, hints.get(1)).andExpect(status().isConflict());
        unlock(user, roomId, hintIds(otherRoomId).get(0)).andExpect(status().isNotFound());
        unlock(user, roomId, Long.MAX_VALUE).andExpect(status().isNotFound());
        assertEquals(0, unlockedRows(user));
    }

    @Test
    void concurrentUnlocksOfTheSameHintBothSucceedWithOneRow() throws Exception {
        var admin = account(Role.ADMIN);
        long roomId = roomWithHints(admin, "CTF", "Wyścig");
        long hintId = hintIds(roomId).get(0);
        var user = account(Role.USER);

        var start = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(4);
        try {
            var calls = new ArrayList<Future<Integer>>();
            for (int i = 0; i < 4; i++) {
                Callable<Integer> call = () -> {
                    start.await();
                    return unlock(user, roomId, hintId).andReturn().getResponse().getStatus();
                };
                calls.add(pool.submit(call));
            }
            start.countDown();
            for (var call : calls) assertEquals(200, call.get());
        } finally {
            pool.shutdownNow();
        }
        assertEquals(1, unlockedRows(user));
    }

    @Test
    void pathRoomsHideHintsAndGuardUnlocksBehindThePathQueue() throws Exception {
        var admin = account(Role.ADMIN);
        long first = roomWithHints(admin, "PATH", "Ścieżka 1");
        long second = roomWithHints(admin, "PATH", "Ścieżka 2");
        long pathId = createPath(admin, "ROOM", List.of(first, second));
        var user = account(Role.USER);
        mockMvc.perform(post("/api/paths/" + pathId + "/enroll").header("Authorization", "Bearer " + user.token()))
                .andExpect(status().isOk());

        getAs(user, "/api/rooms/" + first).andExpect(status().isOk())
                .andExpect(jsonPath("$.hints[0].description").doesNotExist());
        unlock(user, second, hintIds(second).get(0)).andExpect(status().isForbidden());
        unlock(user, first, hintIds(first).get(0)).andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("Ścieżka 1"));
        assertEquals(1, unlockedRows(user));
    }

    @Test
    void onlyThePreviewShowsFullHintContentToStaff() throws Exception {
        var admin = account(Role.ADMIN);
        long roomId = roomWithHints(admin, "CTF", "Dla autora");
        var expert = account(Role.EXPERT);
        var user = account(Role.USER);

        getAs(admin, "/api/rooms/" + roomId).andExpect(status().isOk())
                .andExpect(jsonPath("$.hints[0].description").doesNotExist());
        for (var staff : Map.of("admin", admin, "expert", expert).values()) {
            getAs(staff, "/api/admin/content/rooms/" + roomId + "/preview").andExpect(status().isOk())
                    .andExpect(jsonPath("$.hints[0].order").value(0))
                    .andExpect(jsonPath("$.hints[0].description").value("Dla autora"));
        }
        getAs(user, "/api/admin/content/rooms/" + roomId + "/preview").andExpect(status().isForbidden());
        assertEquals(0, unlockedRows(admin));
    }
}
