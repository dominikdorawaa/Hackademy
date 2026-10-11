package com.hackademy.server;

import com.hackademy.server.arena.ArenaService;
import com.hackademy.server.arena.GameSession;
import com.hackademy.server.arena.MatchmakingService;
import com.hackademy.server.auth.JwtService;
import com.hackademy.server.friendship.FriendshipService;
import com.hackademy.server.realtime.RealtimeStateService;
import com.hackademy.server.room.Room;
import com.hackademy.server.room.RoomRepository;
import com.hackademy.server.room.DifficultyLevel;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import com.jayway.jsonpath.JsonPath;
import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;

import java.net.http.HttpClient;
import java.util.UUID;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.lang.management.ManagementFactory;
import java.util.Arrays;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;

import static org.junit.jupiter.api.Assertions.*;
import static org.awaitility.Awaitility.await;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "DB_URL=jdbc:h2:mem:realtime_test", "DB_USERNAME=sa", "DB_PASSWORD=",
        "JWT_SECRET=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
        "FRONTEND_URL=https://frontend.example.com", "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class RealtimeIntegrationTest {
    @Value("${local.server.port}") private int port;
    @Autowired private UserRepository users;
    @Autowired private JwtService jwt;
    @Autowired private FriendshipService friendships;
    @Autowired private ArenaService arena;
    @Autowired private MatchmakingService matchmaking;
    @Autowired private RealtimeStateService states;
    @Autowired private RoomRepository rooms;
    @Autowired private PlatformTransactionManager transactions;
    @Autowired private DataSource dataSource;
    private final HttpClient client = HttpClient.newHttpClient();

    private User user() {
        String name = "live" + UUID.randomUUID().toString().substring(0, 8);
        return users.saveAndFlush(User.builder().username(name).email(name + "@example.com").password("unused").build());
    }

    private RealtimeSocket connected(User user) throws Exception {
        var socket = RealtimeSocket.open(client, port, jwt.generateToken(user));
        socket.subscribe();
        return socket;
    }

    private String rename(User user, String username) throws Exception {
        var response = client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/user/me/username"))
                .header("Authorization", "Bearer " + jwt.generateToken(user))
                .header("Content-Type", "application/json")
                .method("PATCH", HttpRequest.BodyPublishers.ofString("{\"newUsername\":\"" + username + "\"}"))
                .build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, response.statusCode());
        return JsonPath.read(response.body(), "$.token");
    }

    private String state(String token) throws Exception {
        var response = client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/realtime/state"))
                .header("Authorization", "Bearer " + token).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, response.statusCode());
        return response.body();
    }

    private User claimName(String username) {
        var replacement = user();
        replacement.setUsername(username);
        return users.saveAndFlush(replacement);
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 2})
    void renamingEitherPlayerKeepsMatchAndEventsThroughReconnect(int player) throws Exception {
        var a = user();
        var b = user();
        var renamed = player == 1 ? a : b;
        String oldName = renamed.getUsername();
        var game = new GameSession();
        game.setId(UUID.randomUUID().toString());
        game.setPlayer1Id(a.getId());
        game.setPlayer1Username(a.getUsername());
        game.setPlayer2Id(b.getId());
        game.setPlayer2Username(b.getUsername());
        game.setStartTime(LocalDateTime.now());
        game.setStatus("ACTIVE");
        try (var sa = connected(a); var sb = connected(b)) {
            arena.addGame(game);
            sa.receive();
            sb.receive();
            String token = rename(renamed, "renamed" + UUID.randomUUID().toString().substring(0, 8));
            assertEquals(game.getId(), JsonPath.read(state(token), "$.gameSession.id"));
            try (var reusedName = connected(claimName(oldName))) {
                arena.useHint(game.getId(), renamed.getId(), 9L);
                assertEquals(game.getId(), JsonPath.read(RealtimeSocket.body(sa.receive()), "$.state.gameSession.id"));
                assertEquals(game.getId(), JsonPath.read(RealtimeSocket.body(sb.receive()), "$.state.gameSession.id"));
                assertNull(reusedName.poll(100));
                (player == 1 ? sa : sb).close();
                try (var reconnected = RealtimeSocket.open(client, port, token)) {
                    reconnected.subscribe();
                    assertEquals(9, ((Number) JsonPath.read(state(token), "$.gameSession.hintsUsed['" + renamed.getId() + "'][0]")).intValue());
                    arena.surrenderGame(game.getId(), renamed.getId());
                    assertEquals("FINISHED", JsonPath.read(RealtimeSocket.body(reconnected.receive()), "$.state.gameSession.status"));
                    assertEquals("FINISHED", JsonPath.read(RealtimeSocket.body((player == 1 ? sb : sa).receive()), "$.state.gameSession.status"));
                    assertEquals("FINISHED", JsonPath.read(state(token), "$.gameSession.status"));
                    assertNull(reusedName.poll(100));
                }
            }
        }
    }

    @Test
    void renamingPreservesChallengeQueueAndFriendshipRecipients() throws Exception {
        var a = user();
        var b = user();
        String oldName = a.getUsername();
        String newName = "renamed" + UUID.randomUUID().toString().substring(0, 8);
        try (var original = connected(a); var target = connected(b)) {
            var challenge = arena.createChallenge(a.getId(), oldName, b.getId(), b.getUsername(), false);
            original.receive();
            target.receive();
            String token = rename(a, newName);
            original.close();
            try (var renamed = RealtimeSocket.open(client, port, token); var reusedName = connected(claimName(oldName))) {
                renamed.subscribe();
                assertEquals(challenge.getId(), JsonPath.read(state(token), "$.outgoingChallenges[0].id"));
                arena.cancelChallenge(challenge.getId(), a.getId());
                assertEquals(0, (int) JsonPath.read(RealtimeSocket.body(renamed.receive()), "$.state.outgoingChallenges.length()"));
                target.receive();
                matchmaking.joinQueue(a.getId(), oldName, false);
                assertEquals(true, JsonPath.read(RealtimeSocket.body(renamed.receive()), "$.state.queued"));
                matchmaking.leaveQueue(a.getId());
                assertEquals(false, JsonPath.read(RealtimeSocket.body(renamed.receive()), "$.state.queued"));
                friendships.sendFriendRequest(b.getId(), newName);
                assertEquals(b.getUsername(), JsonPath.read(RealtimeSocket.body(renamed.receive()), "$.state.friendRequests[0].requesterUsername"));
                target.receive();
                assertNull(reusedName.poll(100));
            }
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"service", "http"})
    void waitingSnapshotsReleaseDatabaseConnectionsBeforeTakingTheGameLock(String entryPoint) throws Exception {
        var a = user();
        var b = user();
        var game = new GameSession();
        game.setId(UUID.randomUUID().toString());
        game.setPlayer1Id(a.getId());
        game.setPlayer1Username(a.getUsername());
        game.setPlayer2Id(b.getId());
        game.setPlayer2Username(b.getUsername());
        game.setStartTime(LocalDateTime.now());
        game.setStatus("ACTIVE");
        arena.addGame(game);
        var pool = (HikariDataSource) dataSource;
        assertEquals(5, pool.getMaximumPoolSize());
        var executor = Executors.newFixedThreadPool(5);
        var snapshots = new ArrayList<java.util.concurrent.Future<?>>();
        try {
            synchronized (game) {
                for (int i = 0; i < 5; i++) {
                    Long userId = i % 2 == 0 ? a.getId() : b.getId();
                    String token = jwt.generateToken(i % 2 == 0 ? a : b);
                    snapshots.add(executor.submit(() -> {
                        if ("http".equals(entryPoint)) {
                            var response = client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/realtime/state"))
                                    .header("Authorization", "Bearer " + token).GET().build(), HttpResponse.BodyHandlers.ofString());
                            assertEquals(200, response.statusCode());
                            return response.body();
                        }
                        return states.forUser(userId);
                    }));
                }
                await().atMost(5, TimeUnit.SECONDS).until(() -> Arrays.stream(ManagementFactory.getThreadMXBean().dumpAllThreads(false, false))
                        .filter(thread -> thread.getThreadState() == Thread.State.BLOCKED)
                        .filter(thread -> Arrays.stream(thread.getStackTrace()).anyMatch(frame ->
                                frame.getClassName().equals(RealtimeStateService.class.getName()) && frame.getMethodName().equals("forUser")))
                        .count() == 5);
                assertEquals(0, pool.getHikariPoolMXBean().getActiveConnections());
                arena.finishGame(game.getId(), a.getId());
                assertEquals("FINISHED", game.getStatus());
                assertNotNull(game.getPlayer1EloChange());
            }
            for (var snapshot : snapshots) snapshot.get(5, TimeUnit.SECONDS);
            assertEquals("FINISHED", states.forUser(a.getId()).gameSession().getStatus());
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void deliversCommittedFriendshipChangesOnceToBothParticipantsOnly() throws Exception {
        var sender = user(); var receiver = user(); var outsider = user();
        try (var a = connected(sender); var b = connected(receiver); var c = connected(outsider)) {
            new TransactionTemplate(transactions).executeWithoutResult(transaction -> {
                friendships.sendFriendRequest(sender.getId(), receiver.getUsername());
                try { assertNull(b.poll(100)); } catch (InterruptedException exception) { throw new RuntimeException(exception); }
            });
            String incoming = RealtimeSocket.body(b.receive());
            Number requestId = JsonPath.read(incoming, "$.state.friendRequests[0].id");
            assertEquals(sender.getUsername(), JsonPath.read(incoming, "$.state.friendRequests[0].requesterUsername"));
            assertTrue(RealtimeSocket.body(a.receive()).contains("\"type\":\"STATE\""));
            friendships.acceptFriendRequest(receiver.getId(), requestId.longValue());
            assertEquals(receiver.getUsername(), JsonPath.read(RealtimeSocket.body(a.receive()), "$.state.friends[0].username"));
            assertEquals(sender.getUsername(), JsonPath.read(RealtimeSocket.body(b.receive()), "$.state.friends[0].username"));
            friendships.removeFriend(sender.getId(), receiver.getId());
            assertEquals(0, (int) JsonPath.read(RealtimeSocket.body(a.receive()), "$.state.friends.length()"));
            assertEquals(0, (int) JsonPath.read(RealtimeSocket.body(b.receive()), "$.state.friends.length()"));
            friendships.sendFriendRequest(sender.getId(), receiver.getUsername());
            requestId = JsonPath.read(RealtimeSocket.body(b.receive()), "$.state.friendRequests[0].id"); a.receive();
            friendships.rejectFriendRequest(receiver.getId(), requestId.longValue());
            assertEquals(0, (int) JsonPath.read(RealtimeSocket.body(b.receive()), "$.state.friendRequests.length()")); a.receive();
            assertNull(a.poll(100)); assertNull(b.poll(100)); assertNull(c.poll(100));
        }
    }

    @Test
    void rollbackDoesNotSendAndReconnectRestoresMissedChanges() throws Exception {
        var sender = user(); var receiver = user();
        try (var socket = connected(receiver)) {
            new TransactionTemplate(transactions).executeWithoutResult(transaction -> {
                friendships.sendFriendRequest(sender.getId(), receiver.getUsername());
                transaction.setRollbackOnly();
            });
            assertNull(socket.poll(200));
        }
        friendships.sendFriendRequest(sender.getId(), receiver.getUsername());
        try (var reconnected = connected(receiver)) {
            var recovered = states.forUser(receiver.getId());
            assertEquals(1, recovered.friendRequests().size());
            friendships.rejectFriendRequest(receiver.getId(), recovered.friendRequests().get(0).id());
            assertEquals(0, (int) JsonPath.read(RealtimeSocket.body(reconnected.receive()), "$.state.friendRequests.length()"));
        }
    }

    @Test
    void challengesQueueMatchesAndResultsUpdateBothPlayers() throws Exception {
        var a = user(); var b = user();
        rooms.saveAndFlush(Room.builder().title("live" + UUID.randomUUID()).description("test").difficulty(DifficultyLevel.EASY)
                .category("test").points(10).flag("test").requiresVpn(false).build());
        try (var sa = connected(a); var sb = connected(b)) {
            var challenge = arena.createChallenge(a.getId(), a.getUsername(), b.getId(), b.getUsername(), false);
            assertEquals(challenge.getId(), JsonPath.read(RealtimeSocket.body(sa.receive()), "$.state.outgoingChallenges[0].id"));
            assertEquals(challenge.getId(), JsonPath.read(RealtimeSocket.body(sb.receive()), "$.state.challenges[0].id"));
            arena.rejectChallenge(challenge.getId(), b.getId()); sa.receive(); sb.receive();
            challenge = arena.createChallenge(a.getId(), a.getUsername(), b.getId(), b.getUsername(), false); sa.receive(); sb.receive();
            assertThrows(IllegalArgumentException.class, () -> arena.cancelChallenge(states.forUser(a.getId()).outgoingChallenges().get(0).getId(), b.getId()));
            arena.cancelChallenge(challenge.getId(), a.getId()); sa.receive(); sb.receive();
            challenge = arena.createChallenge(a.getId(), a.getUsername(), b.getId(), b.getUsername(), false); sa.receive(); sb.receive();
            var game = arena.acceptChallenge(challenge.getId(), b.getId());
            assertEquals(game.getId(), JsonPath.read(RealtimeSocket.body(sa.receive()), "$.state.gameSession.id")); sb.receive();
            arena.surrenderGame(game.getId(), a.getId());
            assertEquals("FINISHED", JsonPath.read(RealtimeSocket.body(sa.receive()), "$.state.gameSession.status")); sb.receive();
            matchmaking.joinQueue(a.getId(), a.getUsername(), false);
            assertEquals(true, JsonPath.read(RealtimeSocket.body(sa.receive()), "$.state.queued"));
            matchmaking.leaveQueue(a.getId());
            assertEquals(false, JsonPath.read(RealtimeSocket.body(sa.receive()), "$.state.queued"));
            arena.addGame(game);
            sa.receive(); sb.receive();
            assertNull(sa.poll(100)); assertNull(sb.poll(100));
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"SUBSCRIBE\nid:bad\ndestination:/topic/test\n\n\0",
            "SUBSCRIBE\nid:bad\ndestination:/queue/realtime-user-other\n\n\0",
            "SUBSCRIBE\nid:bad\ndestination:/user/other/queue/realtime\n\n\0",
            "SEND\ndestination:/user/queue/realtime\n\nforged\0"})
    void authenticatedUsersCannotReadOtherDestinationsOrForgeEvents(String frame) throws Exception {
        try (var socket = RealtimeSocket.open(client, port, jwt.generateToken(user()))) {
            socket.send(frame);
            assertTrue(socket.receive().text().startsWith("ERROR\n"));
        }
    }

    @Test
    void scheduledMatchmakingPublishesTheSameActiveGameToBothPlayers() throws Exception {
        var a = user(); var b = user();
        rooms.saveAndFlush(Room.builder().title("match" + UUID.randomUUID()).description("test").difficulty(DifficultyLevel.EASY)
                .category("test").points(10).flag("test").requiresVpn(false).build());
        try (var sa = connected(a); var sb = connected(b)) {
            matchmaking.joinQueue(a.getId(), a.getUsername(), false);
            sa.receive();
            matchmaking.joinQueue(b.getId(), b.getUsername(), false);
            String gameA = activeGame(sa);
            String gameB = activeGame(sb);
            assertEquals(gameA, gameB);
            assertFalse(states.forUser(a.getId()).queued());
            assertFalse(states.forUser(b.getId()).queued());
        }
    }

    private String activeGame(RealtimeSocket socket) throws Exception {
        for (int index = 0; index < 3; index++) {
            var frame = JsonPath.parse(RealtimeSocket.body(socket.receive()));
            java.util.Map<String, Object> game = frame.read("$.state.gameSession");
            if (game != null && "ACTIVE".equals(game.get("status"))) return (String) game.get("id");
        }
        throw new AssertionError("Match was not delivered");
    }
}
