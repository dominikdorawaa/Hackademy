package com.hackademy.server;

import com.hackademy.server.realtime.RealtimeFriendshipStateService;
import com.hackademy.server.user.Role;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AvatarIntegrationTest extends PostgresIntegrationTest {
    @Autowired
    private RealtimeFriendshipStateService realtimeFriendships;

    private static final String URL = "/api/user/me/avatar";
    private static final String AVATAR = """
            {"outfit":"bluza","hair":"irokez","hat":"brak","skin":"oliwkowa","hairColor":"niebieskie",
             "topColor":"bordowy","bottomColor":"granatowy","shoesColor":"bialy","hatColor":"czerwony"}
            """;

    @Test
    void savesAvatarAndShowsItInProfileSearchAndRanking() throws Exception {
        var owner = account(Role.USER);
        var viewer = account(Role.USER);
        getAs(owner, URL).andExpect(status().isNoContent());
        getAs(owner, "/api/user/me").andExpect(jsonPath("$.avatar").value(nullValue()));

        putJson(owner, URL, AVATAR).andExpect(status().isOk())
                .andExpect(jsonPath("$.outfit").value("bluza"))
                .andExpect(jsonPath("$.hairColor").value("niebieskie"));

        getAs(owner, URL).andExpect(status().isOk()).andExpect(jsonPath("$.hair").value("irokez"));
        getAs(owner, "/api/user/me").andExpect(jsonPath("$.avatar.topColor").value("bordowy"))
                .andExpect(jsonPath("$.avatarSeed").doesNotExist());
        getAs(viewer, "/api/user/" + owner.username()).andExpect(jsonPath("$.avatar.outfit").value("bluza"));
        getAs(viewer, "/api/user/search?query=" + owner.username()).andExpect(jsonPath("$[0].avatar.skin").value("oliwkowa"));
        getAs(owner, "/api/ranking/summary").andExpect(jsonPath("$.myRank.avatar.shoesColor").value("bialy"));
        getAs(viewer, "/api/user/" + viewer.username()).andExpect(jsonPath("$.avatar").value(nullValue()));
    }

    @Test
    void acceptsAnyHexColourNextToTheNamedOnes() throws Exception {
        var owner = account(Role.USER);
        var custom = AVATAR.replace("\"skin\":\"oliwkowa\"", "\"skin\":\"#c58c6d\"").replace("\"topColor\":\"bordowy\"", "\"topColor\":\"#00ff88\"");
        putJson(owner, URL, custom).andExpect(status().isOk())
                .andExpect(jsonPath("$.skin").value("#c58c6d"))
                .andExpect(jsonPath("$.topColor").value("#00ff88"));
        for (var wrong : List.of("#00FF88", "#00ff8", "00ff88", "#00ff88aa", "rgb(0,255,136)")) {
            putJson(owner, URL, custom.replace("#00ff88", wrong)).andExpect(status().isBadRequest());
        }
        getAs(owner, URL).andExpect(jsonPath("$.topColor").value("#00ff88"));
        assertEquals("#c58c6d", jdbcTemplate.queryForObject("SELECT skin FROM user_avatars WHERE user_id = ?", String.class, owner.id()));
        assertThrows(DataIntegrityViolationException.class, () -> jdbcTemplate.update("UPDATE user_avatars SET hat_color = '#XYZ123' WHERE user_id = ?", owner.id()));
    }

    @Test
    void updatesTheSavedAvatarAndRejectsUnknownValuesWithoutChangingIt() throws Exception {
        var owner = account(Role.USER);
        putJson(owner, URL, AVATAR).andExpect(status().isOk());
        putJson(owner, URL, AVATAR.replace("\"bluza\"", "\"pirat\"")).andExpect(status().isBadRequest());
        putJson(owner, URL, AVATAR.replace("\"hatColor\":\"czerwony\"", "\"hatColor\":null")).andExpect(status().isBadRequest());
        putJson(owner, URL, "{}").andExpect(status().isBadRequest());
        getAs(owner, URL).andExpect(jsonPath("$.outfit").value("bluza")).andExpect(jsonPath("$.hat").value("brak"));

        putJson(owner, URL, AVATAR.replace("\"hat\":\"brak\"", "\"hat\":\"daszek\"")).andExpect(status().isOk())
                .andExpect(jsonPath("$.hat").value("daszek"));
        getAs(owner, URL).andExpect(jsonPath("$.hat").value("daszek")).andExpect(jsonPath("$.hair").value("irokez"));
        assertEquals(1, jdbcTemplate.queryForObject(
                "SELECT count(*) FROM user_avatars WHERE user_id = ?", Integer.class, owner.id()));
    }

    @Test
    void savesThePortraitPoseAndKeepsTheFrontPoseForOlderClients() throws Exception {
        var owner = account(Role.USER);
        var viewer = account(Role.USER);
        putJson(owner, URL, AVATAR).andExpect(status().isOk()).andExpect(jsonPath("$.pose").value("przod"));
        putJson(owner, URL, AVATAR.replace("}", ",\"pose\":\"profil\"}")).andExpect(status().isOk())
                .andExpect(jsonPath("$.pose").value("profil"));
        getAs(viewer, "/api/user/" + owner.username()).andExpect(jsonPath("$.avatar.pose").value("profil"));
        getAs(owner, "/api/ranking/summary").andExpect(jsonPath("$.myRank.avatar.pose").value("profil"));
        putJson(owner, URL, AVATAR.replace("}", ",\"pose\":\"bokiem\"}")).andExpect(status().isBadRequest());
        putJson(owner, URL, AVATAR.replace("}", ",\"pose\":\"postawa\"}")).andExpect(status().isOk());
        getAs(owner, URL).andExpect(jsonPath("$.pose").value("postawa"));
        assertEquals("postawa", jdbcTemplate.queryForObject("SELECT pose FROM user_avatars WHERE user_id = ?", String.class, owner.id()));
    }

    @Test
    void deletingTheAvatarFallsBackToTheGeneratedPortrait() throws Exception {
        var owner = account(Role.USER);
        putJson(owner, URL, AVATAR).andExpect(status().isOk());
        mockMvc.perform(delete(URL).header("Authorization", "Bearer " + owner.token())).andExpect(status().isNoContent());
        getAs(owner, URL).andExpect(status().isNoContent());
        getAs(owner, "/api/user/me").andExpect(jsonPath("$.avatar").value(nullValue()))
                .andExpect(jsonPath("$.avatarSeed").doesNotExist());
        mockMvc.perform(delete(URL).header("Authorization", "Bearer " + owner.token())).andExpect(status().isNoContent());
    }

    @Test
    void friendsAndPendingRequestsCarryTheAvatar() throws Exception {
        var sender = account(Role.USER);
        var receiver = account(Role.USER);
        putJson(sender, URL, AVATAR).andExpect(status().isOk());
        mockMvc.perform(post("/api/friends/request/" + receiver.username()).header("Authorization", "Bearer " + sender.token()))
                .andExpect(status().isOk());
        var requests = getAs(receiver, "/api/friends/requests").andExpect(status().isOk())
                .andExpect(jsonPath("$[0].avatar.outfit").value("bluza")).andReturn();
        Number requestId = JsonPath.read(requests.getResponse().getContentAsString(), "$[0].id");
        mockMvc.perform(post("/api/friends/accept/" + requestId).header("Authorization", "Bearer " + receiver.token()))
                .andExpect(status().isOk());
        getAs(receiver, "/api/friends").andExpect(jsonPath("$[0].avatar.hairColor").value("niebieskie"));
        getAs(sender, "/api/friends").andExpect(jsonPath("$[0].avatar").value(nullValue()));
    }

    @Test
    void cachedFriendListsAndRealtimeStateShowAnAvatarChange() throws Exception {
        var friend = account(Role.USER);
        var viewer = account(Role.USER);
        var stranger = account(Role.USER);
        mockMvc.perform(post("/api/friends/request/" + viewer.username()).header("Authorization", "Bearer " + friend.token()))
                .andExpect(status().isOk());
        var requests = getAs(viewer, "/api/friends/requests").andReturn();
        Number requestId = JsonPath.read(requests.getResponse().getContentAsString(), "$[0].id");
        mockMvc.perform(post("/api/friends/accept/" + requestId).header("Authorization", "Bearer " + viewer.token()))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/friends/request/" + viewer.username()).header("Authorization", "Bearer " + stranger.token()))
                .andExpect(status().isOk());
        getAs(viewer, "/api/friends").andExpect(jsonPath("$[0].avatar").value(nullValue()));
        getAs(viewer, "/api/friends/requests").andExpect(jsonPath("$[0].avatar").value(nullValue()));

        putJson(friend, URL, AVATAR).andExpect(status().isOk());
        putJson(stranger, URL, AVATAR.replace("\"bluza\"", "\"dres\"")).andExpect(status().isOk());

        getAs(viewer, "/api/friends").andExpect(jsonPath("$[0].avatar.outfit").value("bluza"));
        getAs(viewer, "/api/friends/requests").andExpect(jsonPath("$[0].avatar.outfit").value("dres"));
        var state = realtimeFriendships.forUser(viewer.id());
        assertEquals("bluza", state.friends().get(0).avatar().outfit());
        assertEquals("dres", state.requests().get(0).avatar().outfit());
    }

    @Test
    void rejectsAvatarChangesWithoutLogin() throws Exception {
        mockMvc.perform(put(URL).contentType("application/json").content(AVATAR))
                .andExpect(result -> assertTrue(result.getResponse().getStatus() >= 400));
    }
}
