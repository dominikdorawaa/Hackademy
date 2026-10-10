package com.hackademy.server;

import com.hackademy.server.user.Role;
import com.hackademy.server.user.UserRepository;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserServiceImpl;
import com.hackademy.server.room.DifficultyLevel;
import com.hackademy.server.room.Room;
import com.hackademy.server.room.RoomRepository;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.util.UUID;
import java.sql.Timestamp;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "JWT_SECRET=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
@AutoConfigureMockMvc
@Testcontainers
class AuthAndAdminIntegrationTest {
    @Test
    void savesPersonalizationWithOrderedOwnedBadgesAndKeepsAvatarAfterUsernameChange() throws Exception {
        var token = tokenFor(Role.USER);
        var current = mockMvc.perform(get("/api/user/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String username = JsonPath.read(current, "$.username");
        var user = userRepository.findByUsername(username).orElseThrow();
        var badgeIds = jdbcTemplate.queryForList("SELECT id FROM badges ORDER BY id LIMIT 2", Long.class);
        for (var badgeId : badgeIds) {
            jdbcTemplate.update("INSERT INTO user_badges (user_id, badge_id, earned_at) VALUES (?, ?, CURRENT_TIMESTAMP)", user.getId(), badgeId);
        }
        var body = "{\"bio\":\"  Uczę się Linuxa  \",\"tagline\":\"Cyber explorer\",\"avatarSeed\":\"chosen-seed\",\"interests\":[\"LINUX\",\"WEB\"],\"featuredBadgeIds\":" + badgeIds + "}";
        mockMvc.perform(patch("/api/user/me/profile").header("Authorization", "Bearer " + token).contentType("application/json").content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.bio").value("Uczę się Linuxa"))
                .andExpect(jsonPath("$.avatarSeed").value("chosen-seed"));
        mockMvc.perform(get("/api/user/" + username).header("Authorization", "Bearer " + tokenFor(Role.EXPERT)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.tagline").value("Cyber explorer"))
                .andExpect(jsonPath("$.interests[0]").value("LINUX"))
                .andExpect(jsonPath("$.featuredBadgeIds[0]").value(badgeIds.get(0).intValue()))
                .andExpect(jsonPath("$.email").doesNotExist());
        var reordered = body.replace("[\"LINUX\",\"WEB\"]", "[\"WEB\",\"LINUX\"]")
                .replace(badgeIds.toString(), java.util.List.of(badgeIds.get(1), badgeIds.get(0)).toString());
        mockMvc.perform(patch("/api/user/me/profile").header("Authorization", "Bearer " + token).contentType("application/json").content(reordered))
                .andExpect(status().isOk()).andExpect(jsonPath("$.featuredBadgeIds[0]").value(badgeIds.get(1).intValue()));
        mockMvc.perform(get("/api/dashboard/summary").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.user.avatarSeed").value("chosen-seed"));
        var renamed = username + "x";
        mockMvc.perform(patch("/api/user/me/username").header("Authorization", "Bearer " + token).contentType("application/json")
                .content("{\"newUsername\":\"" + renamed + "\"}"))
                .andExpect(status().isOk());
        assertEquals("chosen-seed", userRepository.findByUsername(renamed).orElseThrow().getAvatarSeed());
    }

    @Test
    void refreshesCachedAvatarsAfterSavingProfile() throws Exception {
        var ownerToken = tokenFor(Role.USER);
        var friendToken = tokenFor(Role.USER);
        var requestToken = tokenFor(Role.USER);
        var owner = userForToken(ownerToken);
        var friend = userForToken(friendToken);
        var receiver = userForToken(requestToken);
        jdbcTemplate.update("UPDATE users SET points = 1000000 WHERE id = ?", owner.getId());
        jdbcTemplate.update("INSERT INTO friendships (requester_id, receiver_id, status, requester_wins, receiver_wins, created_at) VALUES (?, ?, 'ACCEPTED', 0, 0, CURRENT_TIMESTAMP)", owner.getId(), friend.getId());
        jdbcTemplate.update("INSERT INTO friendships (requester_id, receiver_id, status, requester_wins, receiver_wins, created_at) VALUES (?, ?, 'PENDING', 0, 0, CURRENT_TIMESTAMP)", owner.getId(), receiver.getId());
        userService.invalidateGlobalRankingCache();
        assertCachedAvatars(ownerToken, friendToken, requestToken, owner.getUsername(), owner.getAvatarSeed());
        var updatedSeed = "changed-" + UUID.randomUUID();
        mockMvc.perform(patch("/api/user/me/profile").header("Authorization", "Bearer " + ownerToken)
                        .contentType("application/json").content("""
                                {"bio":"Learning Linux","tagline":"","avatarSeed":"%s","interests":[],"featuredBadgeIds":[]}
                                """.formatted(updatedSeed)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.avatarSeed").value(updatedSeed));
        assertCachedAvatars(ownerToken, friendToken, requestToken, owner.getUsername(), updatedSeed);
    }

    private User userForToken(String token) throws Exception {
        var response = mockMvc.perform(get("/api/user/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String username = JsonPath.read(response, "$.username");
        return userRepository.findByUsername(username).orElseThrow();
    }

    private void assertCachedAvatars(String ownerToken, String friendToken, String requestToken,
                                    String username, String seed) throws Exception {
        mockMvc.perform(get("/api/dashboard/summary").header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.user.avatarSeed").value(seed));
        mockMvc.perform(get("/api/ranking/summary").header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.myRank.avatarSeed").value(seed))
                .andExpect(jsonPath("$.ranking[?(@.username == '" + username + "')].avatarSeed", contains(seed)));
        mockMvc.perform(get("/api/friends").header("Authorization", "Bearer " + friendToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.username == '" + username + "')].avatarSeed", contains(seed)));
        mockMvc.perform(get("/api/friends/requests").header("Authorization", "Bearer " + requestToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.requesterUsername == '" + username + "')].avatarSeed", contains(seed)));
    }

    @Test
    void rejectsInvalidPersonalizationWithoutPartialWrites() throws Exception {
        var token = tokenFor(Role.USER);
        var current = mockMvc.perform(get("/api/user/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String username = JsonPath.read(current, "$.username");
        var user = userRepository.findByUsername(username).orElseThrow();
        String originalSeed = user.getAvatarSeed();
        var valid = "{\"bio\":\"New bio\",\"tagline\":\"Hello\",\"avatarSeed\":\"new-seed\",\"interests\":[\"WEB\"],\"featuredBadgeIds\":[]}";
        var unearned = jdbcTemplate.queryForObject("SELECT id FROM badges ORDER BY id LIMIT 1", Long.class);
        for (var invalid : java.util.List.of(
                valid.replace("New bio", "x".repeat(501)), valid.replace("Hello", "x".repeat(101)),
                valid.replace("new-seed", " "), valid.replace("[\"WEB\"]", "[\"UNKNOWN\"]"),
                valid.replace("[\"WEB\"]", "[\"WEB\",\"WEB\"]"),
                valid.replace("[\"WEB\"]", "[\"WEB\",\"LINUX\",\"WINDOWS\",\"SOC\",\"NETWORKS\",\"PENTESTING\"]"),
                valid.replace("\"featuredBadgeIds\":[]", "\"featuredBadgeIds\":[" + unearned + "]"),
                valid.replace("\"featuredBadgeIds\":[]", "\"featuredBadgeIds\":[1,2,3,4]"))) {
            mockMvc.perform(patch("/api/user/me/profile").header("Authorization", "Bearer " + token)
                    .contentType("application/json").content(invalid)).andExpect(status().isBadRequest());
            assertEquals(originalSeed, userRepository.findByUsername(username).orElseThrow().getAvatarSeed());
        }
        mockMvc.perform(patch("/api/user/me/profile").contentType("application/json").content(valid))
                .andExpect(status().isForbidden());
    }
    @Container
    private static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17.11-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("DB_URL", postgres::getJdbcUrl);
        registry.add("DB_USERNAME", postgres::getUsername);
        registry.add("DB_PASSWORD", postgres::getPassword);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserServiceImpl userService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private RoomRepository roomRepository;

    @Test
    void exposesRecentSolvedRoomsToEveryAuthenticatedRoleWithBoundedLimits() throws Exception {
        var username = "history" + UUID.randomUUID().toString().substring(0, 8);
        mockMvc.perform(post("/api/auth/register").contentType("application/json")
                .content(registerBody(username, username + "@example.com"))).andExpect(status().isOk());
        var owner = userRepository.findByUsername(username).orElseThrow();
        for (int index = 0; index < 25; index++) {
            var room = roomRepository.saveAndFlush(Room.builder()
                    .title(username + " room " + index).description("Example room")
                    .difficulty(DifficultyLevel.EASY).category("Test").points(10).flag("example-flag").build());
            jdbcTemplate.update("INSERT INTO user_solved_rooms (user_id, room_id, solved_at) VALUES (?, ?, ?)",
                    owner.getId(), room.getId(), Timestamp.valueOf(LocalDateTime.of(2026, 1, 1, 12, 0).plusDays(index)));
        }
        var url = "/api/user/" + username + "/recent-solved";
        for (var role : Role.values()) {
            var token = tokenFor(role);
            mockMvc.perform(get(url).header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(5)))
                    .andExpect(jsonPath("$[0].title").value(username + " room 24"))
                    .andExpect(jsonPath("$[0].difficulty").value("EASY"))
                    .andExpect(jsonPath("$[0].points").value(10))
                    .andExpect(jsonPath("$[0].solvedAt").exists())
                    .andExpect(jsonPath("$[0].flag").doesNotExist())
                    .andExpect(jsonPath("$[0].email").doesNotExist());
            mockMvc.perform(get(url).param("limit", "100").header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(20)))
                    .andExpect(jsonPath("$[19].title").value(username + " room 5"));
            mockMvc.perform(get(url).param("limit", "0").header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)));
            mockMvc.perform(get("/api/user/" + username + "/portfolio").header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.practiceAreas", hasSize(1)))
                    .andExpect(jsonPath("$.practiceAreas[0].category").value("Test"))
                    .andExpect(jsonPath("$.practiceAreas[0].solvedRooms").value(25))
                    .andExpect(jsonPath("$.completedPaths", hasSize(0)))
                    .andExpect(jsonPath("$.email").doesNotExist()).andExpect(jsonPath("$.flag").doesNotExist());
        }
        mockMvc.perform(get(url)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/user/" + username + "/portfolio")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/user/missing" + UUID.randomUUID() + "/portfolio")
                .header("Authorization", "Bearer " + tokenFor(Role.USER))).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/user/missing" + UUID.randomUUID() + "/recent-solved")
                .header("Authorization", "Bearer " + tokenFor(Role.USER))).andExpect(status().isNotFound());
    }

    @Test
    void validatesSavesAndClearsBio() throws Exception {
        var token = tokenFor(Role.USER);
        var response = mockMvc.perform(get("/api/user/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn();
        String username = JsonPath.read(response.getResponse().getContentAsString(), "$.username");
        mockMvc.perform(patch("/api/user/me/bio").header("Authorization", "Bearer " + token)
                        .contentType("application/json").content("{\"bio\":\"Learning web security\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/user/" + username).header("Authorization", "Bearer " + tokenFor(Role.EXPERT)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.bio").value("Learning web security"));
        mockMvc.perform(patch("/api/user/me/bio").header("Authorization", "Bearer " + token)
                        .contentType("application/json").content("{\"bio\":\"" + "x".repeat(501) + "\"}"))
                .andExpect(status().isBadRequest());
        assertEquals("Learning web security", userRepository.findByUsername(username).orElseThrow().getBio());
        mockMvc.perform(patch("/api/user/me/bio").header("Authorization", "Bearer " + token)
                        .contentType("application/json").content("{\"bio\":\"\"}"))
                .andExpect(status().isOk());
        assertEquals("", userRepository.findByUsername(username).orElseThrow().getBio());
        mockMvc.perform(get("/api/user/" + username + "/recent-solved").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void exposesAccurateProfileFactsWithoutLeakingPrivateData() throws Exception {
        var token = tokenFor(Role.USER);
        var response = mockMvc.perform(get("/api/user/me").header("Authorization", "Bearer " + token)).andReturn();
        String username = JsonPath.read(response.getResponse().getContentAsString(), "$.username");
        var owner = userRepository.findByUsername(username).orElseThrow();
        mockMvc.perform(get("/api/user/me/stats").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.solvedRooms").value(0))
                .andExpect(jsonPath("$.unlockedHints").value(0)).andExpect(jsonPath("$.earnedBadges").value(0))
                .andExpect(jsonPath("$.arenaRating").value(500)).andExpect(jsonPath("$.completedPaths").value(0));
        mockMvc.perform(get("/api/user/me/portfolio").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.practiceAreas", hasSize(0)))
                .andExpect(jsonPath("$.completedPaths", hasSize(0)));
        owner.setElo(610);
        userRepository.saveAndFlush(owner);
        var room = roomRepository.saveAndFlush(Room.builder().title(username + " facts")
                .description("Example room").difficulty(DifficultyLevel.EASY).category("Test")
                .points(10).flag("example-flag").build());
        jdbcTemplate.update("INSERT INTO user_solved_rooms (user_id, room_id, solved_at) VALUES (?, ?, ?)",
                owner.getId(), room.getId(), Timestamp.valueOf(LocalDateTime.now()));
        mockMvc.perform(get("/api/user/me/activity").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].date").value(java.time.LocalDate.now().toString()))
                .andExpect(jsonPath("$[0].count").value(1));
        var hintId = jdbcTemplate.queryForObject("INSERT INTO hints (description, room_id) VALUES (?, ?) RETURNING id",
                Long.class, "Example hint", room.getId());
        var unsolvedRoom = roomRepository.saveAndFlush(Room.builder().title(username + " unsolved")
                .description("Example room").difficulty(DifficultyLevel.EASY).category("Test")
                .points(10).flag("example-flag").build());
        for (var pathKind : new String[] { "complete", "partial", "empty" }) {
            var pathId = jdbcTemplate.queryForObject(
                    "INSERT INTO paths (title, created_at, updated_at) VALUES (?, ?, ?) RETURNING id",
                    Long.class, username + " " + pathKind, Timestamp.valueOf(LocalDateTime.now()),
                    Timestamp.valueOf(LocalDateTime.now()));
            if (!pathKind.equals("empty")) {
                jdbcTemplate.update("INSERT INTO path_rooms (path_id, room_id, sort_order) VALUES (?, ?, 0)",
                        pathId, room.getId());
            }
            if (pathKind.equals("partial")) {
                jdbcTemplate.update("INSERT INTO path_rooms (path_id, room_id, sort_order) VALUES (?, ?, 1)",
                        pathId, unsolvedRoom.getId());
            }
        }
        jdbcTemplate.update("INSERT INTO user_unlocked_hints (user_id, hint_id) VALUES (?, ?)", owner.getId(), hintId);
        jdbcTemplate.update("INSERT INTO user_badges (user_id, badge_id, earned_at) VALUES (?, (SELECT MIN(id) FROM badges), ?)",
                owner.getId(), Timestamp.valueOf(LocalDateTime.now()));
        for (var role : Role.values()) {
            var viewerToken = tokenFor(role);
            mockMvc.perform(get("/api/user/" + username + "/activity").header("Authorization", "Bearer " + viewerToken))
                    .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)))
                    .andExpect(jsonPath("$[0].date").value(java.time.LocalDate.now().toString()))
                    .andExpect(jsonPath("$[0].count").value(1));
            mockMvc.perform(get("/api/user/" + username).header("Authorization", "Bearer " + viewerToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.badges[?(@.earned == true)]", hasSize(1)))
                    .andExpect(jsonPath("$.badges[?(@.earned == false)]").isNotEmpty());
            mockMvc.perform(get("/api/user/" + username + "/stats").header("Authorization", "Bearer " + viewerToken))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.solvedRooms").value(1))
                    .andExpect(jsonPath("$.unlockedHints").value(1)).andExpect(jsonPath("$.earnedBadges").value(1))
                    .andExpect(jsonPath("$.arenaRating").value(610)).andExpect(jsonPath("$.completedPaths").value(1))
                    .andExpect(jsonPath("$.email").doesNotExist())
                    .andExpect(jsonPath("$.flag").doesNotExist()).andExpect(jsonPath("$.hints").doesNotExist());
            mockMvc.perform(get("/api/user/me/stats").header("Authorization", "Bearer " + viewerToken))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.solvedRooms").value(0))
                    .andExpect(jsonPath("$.unlockedHints").value(0)).andExpect(jsonPath("$.earnedBadges").value(0))
                    .andExpect(jsonPath("$.completedPaths").value(0));
        }
        mockMvc.perform(get("/api/user/" + username + "/stats")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/user/" + username + "/portfolio").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.completedPaths", hasSize(1)))
                .andExpect(jsonPath("$.completedPaths[0].title").value(username + " complete"))
                .andExpect(jsonPath("$.completedPaths[0].roomsCount").value(1));
        mockMvc.perform(get("/api/user/me/stats").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.arenaRating").value(610))
                .andExpect(jsonPath("$.completedPaths").value(1));
        mockMvc.perform(get("/api/user/missing" + UUID.randomUUID() + "/stats")
                .header("Authorization", "Bearer " + token)).andExpect(status().isNotFound());
    }

    @Test
    void exposesCurrentBadgeProgressAndPreservesAwardedMilestones() throws Exception {
        var token = tokenFor(Role.USER);
        var response = mockMvc.perform(get("/api/user/me").header("Authorization", "Bearer " + token)).andReturn();
        String username = JsonPath.read(response.getResponse().getContentAsString(), "$.username");
        var owner = userRepository.findByUsername(username).orElseThrow();
        owner.setPoints(30);
        owner.setStreak(3);
        owner.setLastSolvedDate(java.time.LocalDate.now().minusDays(3));
        userRepository.saveAndFlush(owner);
        mockMvc.perform(get("/api/badges/all").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.name == 'Script Kiddie')].progress.current").value(org.hamcrest.Matchers.contains(30)))
                .andExpect(jsonPath("$[?(@.name == 'Script Kiddie')].progress.target").value(org.hamcrest.Matchers.contains(100)))
                .andExpect(jsonPath("$[?(@.name == 'Script Kiddie')].progress.conditionType").value(org.hamcrest.Matchers.contains("POINTS")))
                .andExpect(jsonPath("$[?(@.name == 'Streak Novice')].progress.current").value(org.hamcrest.Matchers.contains(0)))
                .andExpect(jsonPath("$[?(@.name == 'Hello World')].progress.current").value(org.hamcrest.Matchers.contains(0)))
                .andExpect(jsonPath("$[?(@.name == 'Social Butterfly')].progress.current").value(org.hamcrest.Matchers.contains(0)));
        owner.setLastSolvedDate(java.time.LocalDate.now());
        owner.setPoints(150);
        userRepository.saveAndFlush(owner);
        mockMvc.perform(get("/api/badges/all").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.name == 'Script Kiddie')].progress.current").value(org.hamcrest.Matchers.contains(100)))
                .andExpect(jsonPath("$[?(@.name == 'Streak Novice')].progress.current").value(org.hamcrest.Matchers.contains(3)));
        jdbcTemplate.update("INSERT INTO user_badges (user_id, badge_id, earned_at) VALUES (?, (SELECT id FROM badges WHERE name = 'Streak Novice'), ?)",
                owner.getId(), Timestamp.valueOf(LocalDateTime.now()));
        owner.setLastSolvedDate(java.time.LocalDate.now().minusDays(3));
        userRepository.saveAndFlush(owner);
        mockMvc.perform(get("/api/user/" + username).header("Authorization", "Bearer " + tokenFor(Role.EXPERT)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.badges[?(@.name == 'Streak Novice')].progress.current").value(org.hamcrest.Matchers.contains(3)))
                .andExpect(jsonPath("$.badges[?(@.name == 'Script Kiddie')].progress.current").value(org.hamcrest.Matchers.contains(100)));
    }

    @Test
    void registersAndLogsInAgainstMigratedDatabase() throws Exception {
        assertEquals(3, jdbcTemplate.queryForObject(
                "SELECT count(*) FROM flyway_schema_history WHERE success", Integer.class));

        var username = "user" + UUID.randomUUID().toString().substring(0, 8);
        var email = username + "@example.com";
        var registration = mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content(registerBody(username, email)))
                .andExpect(status().isOk())
                .andReturn();
        assertNotNull(JsonPath.read(registration.getResponse().getContentAsString(), "$.token"));

        var savedUser = userRepository.findByEmail(email).orElseThrow();
        assertEquals(Role.USER, savedUser.getRole());
        assertNotEquals("password123", savedUser.getPassword());

        var login = mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(loginBody(email.toUpperCase(), "password123")))
                .andExpect(status().isOk())
                .andReturn();
        assertFalse(((String) JsonPath.read(login.getResponse().getContentAsString(), "$.token")).isBlank());

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(loginBody(email, "wrong-password")))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content(registerBody(username, email)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void enforcesAdminEndpointPermissionsForEveryRole() throws Exception {
        var userToken = tokenFor(Role.USER);
        var expertToken = tokenFor(Role.EXPERT);
        var adminToken = tokenFor(Role.ADMIN);

        mockMvc.perform(get("/api/admin/rooms").header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/rooms").header("Authorization", "Bearer " + expertToken))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/admin/rooms").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/admin/users").header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/users").header("Authorization", "Bearer " + expertToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/users").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    private String tokenFor(Role role) throws Exception {
        var username = role.name().toLowerCase() + UUID.randomUUID().toString().substring(0, 8);
        var email = username + "@example.com";
        mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content(registerBody(username, email)))
                .andExpect(status().isOk());

        var savedUser = userRepository.findByEmail(email).orElseThrow();
        savedUser.setRole(role);
        userRepository.saveAndFlush(savedUser);

        var login = mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(loginBody(email, "password123")))
                .andExpect(status().isOk())
                .andReturn();
        return JsonPath.read(login.getResponse().getContentAsString(), "$.token");
    }

    private String registerBody(String username, String email) {
        return """
                {"username":"%s","email":"%s","password":"password123"}
                """.formatted(username, email);
    }

    private String loginBody(String email, String password) {
        return """
                {"email":"%s","password":"%s"}
                """.formatted(email, password);
    }
}
