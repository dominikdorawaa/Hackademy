package com.hackademy.server;

import com.hackademy.server.arena.ArenaServiceImpl;
import com.hackademy.server.arena.Challenge;
import com.hackademy.server.arena.GameSession;
import com.hackademy.server.chat.ChatService;
import com.hackademy.server.dashboard.DashboardSummaryCache;
import com.hackademy.server.friendship.FriendshipRepository;
import com.hackademy.server.realtime.RealtimeNotifier;
import com.hackademy.server.room.RoomRepository;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import com.hackademy.server.user.UserServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ArenaConcurrencyTest {
    private final RoomRepository rooms = mock(RoomRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final ChatService chat = mock(ChatService.class);
    private final RealtimeNotifier realtime = mock(RealtimeNotifier.class);
    private final ArenaServiceImpl arena = new ArenaServiceImpl(rooms, mock(FriendshipRepository.class), users,
            chat, mock(UserServiceImpl.class), mock(DashboardSummaryCache.class), realtime);

    @BeforeEach
    void usersExist() {
        for (long id = 1; id <= 2; id++) {
            User user = new User();
            user.setId(id);
            user.setUsername("player" + id);
            user.setElo(500);
            when(users.findById(id)).thenReturn(Optional.of(user));
        }
        when(rooms.findCtfIdsByVpnRequirement(false)).thenReturn(List.of(7L));
    }

    private Challenge challenge() {
        return arena.createChallenge(1L, "player1", 2L, "player2", false);
    }

    @Test
    void rejectsFlagsForAnAlreadySelectedRoomAfterMovingItToDrafts() {
        var room = new com.hackademy.server.room.Room(); room.setId(7L); room.setFlag("flag"); room.setPublished(false);
        when(rooms.findById(7L)).thenReturn(Optional.of(room));
        var session = arena.acceptChallenge(challenge().getId(), 2L);
        assertFalse(arena.submitFlag(session.getId(), 1L, "flag"));
        assertTrue(arena.getGameSession(session.getId()).getFinishTimes().isEmpty());
        verify(users, never()).save(any());
        room.setPublished(true);
        assertFalse(arena.submitFlag(session.getId(), 1L, "wrong"));
        assertTrue(arena.submitFlag(session.getId(), 1L, "flag"));
        assertEquals("FINISHED", arena.getGameSession(session.getId()).getStatus());
    }

    @Test
    void canceledAndRejectedChallengesCannotStartGames() {
        var canceled = challenge();
        arena.cancelChallenge(canceled.getId(), 1L);
        assertThrows(IllegalArgumentException.class, () -> arena.acceptChallenge(canceled.getId(), 2L));
        var rejected = challenge();
        arena.rejectChallenge(rejected.getId(), 2L);
        assertThrows(IllegalArgumentException.class, () -> arena.acceptChallenge(rejected.getId(), 2L));
        assertNull(arena.findCurrentGameForUser(1L));
    }

    @ParameterizedTest
    @ValueSource(strings = {"cancel", "reject", "accept"})
    void acceptingSerializesCompetingChallengeActions(String action) throws Exception {
        var challenge = challenge();
        var readingRooms = new CountDownLatch(1);
        var releaseRooms = new CountDownLatch(1);
        var competingStarted = new CountDownLatch(1);
        when(rooms.findCtfIdsByVpnRequirement(false)).thenAnswer(invocation -> {
            readingRooms.countDown();
            assertTrue(releaseRooms.await(5, TimeUnit.SECONDS));
            return List.of(7L);
        });
        var executor = Executors.newFixedThreadPool(2);
        try {
            var accepted = executor.submit(() -> arena.acceptChallenge(challenge.getId(), 2L));
            assertTrue(readingRooms.await(5, TimeUnit.SECONDS));
            var competing = executor.submit(() -> {
                competingStarted.countDown();
                switch (action) {
                    case "cancel" -> assertThrows(IllegalArgumentException.class,
                            () -> arena.cancelChallenge(challenge.getId(), 1L));
                    case "accept" -> assertThrows(IllegalArgumentException.class,
                            () -> arena.acceptChallenge(challenge.getId(), 2L));
                    case "reject" -> arena.rejectChallenge(challenge.getId(), 2L);
                    default -> fail("Unknown action");
                }
            });
            assertTrue(competingStarted.await(5, TimeUnit.SECONDS));
            assertThrows(TimeoutException.class, () -> competing.get(100, TimeUnit.MILLISECONDS));
            releaseRooms.countDown();
            assertEquals(accepted.get(5, TimeUnit.SECONDS).getId(), arena.findCurrentGameForUser(1L).getId());
            competing.get(5, TimeUnit.SECONDS);
            verify(rooms, times(1)).findCtfIdsByVpnRequirement(false);
            assertTrue(arena.getOutgoingChallenges(1L).isEmpty());
        } finally {
            releaseRooms.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void concurrentAcceptsStartExactlyOneGame() throws Exception {
        var challenge = challenge();
        var start = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var attempts = new ArrayList<java.util.concurrent.Future<Boolean>>();
            for (int i = 0; i < 2; i++) attempts.add(executor.submit(() -> {
                assertTrue(start.await(5, TimeUnit.SECONDS));
                try {
                    arena.acceptChallenge(challenge.getId(), 2L);
                    return true;
                } catch (IllegalArgumentException invalid) {
                    return false;
                }
            }));
            start.countDown();
            int successes = 0;
            for (var attempt : attempts) if (attempt.get(5, TimeUnit.SECONDS)) successes++;
            assertEquals(1, successes);
            verify(rooms, times(1)).findCtfIdsByVpnRequirement(false);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void failedAcceptanceKeepsChallengeAvailableForRetry() {
        var challenge = challenge();
        when(rooms.findCtfIdsByVpnRequirement(false)).thenReturn(List.of());
        assertThrows(IllegalStateException.class, () -> arena.acceptChallenge(challenge.getId(), 2L));
        assertEquals(1, arena.getPendingChallenges(2L).size());
        when(rooms.findCtfIdsByVpnRequirement(false)).thenReturn(List.of(7L));
        assertNotNull(arena.acceptChallenge(challenge.getId(), 2L));
    }

    private GameSession game() {
        var game = new GameSession();
        game.setId("game");
        game.setPlayer1Id(1L);
        game.setPlayer2Id(2L);
        game.setPlayer1Username("player1");
        game.setPlayer2Username("player2");
        game.setStartTime(LocalDateTime.now());
        game.setStatus("ACTIVE");
        arena.addGame(game);
        return game;
    }

    @Test
    void snapshotsRemainConsistentWhileBothPlayersUseHints() throws Exception {
        game();
        var executor = Executors.newFixedThreadPool(3);
        var start = new CountDownLatch(1);
        try {
            var writers = new ArrayList<java.util.concurrent.Future<?>>();
            for (long id = 1; id <= 2; id++) {
                long userId = id;
                writers.add(executor.submit(() -> {
                    assertTrue(start.await(5, TimeUnit.SECONDS));
                    for (long hint = 1; hint <= 500; hint++) arena.useHint("game", userId, hint);
                    return null;
                }));
            }
            var reader = executor.submit(() -> {
                assertTrue(start.await(5, TimeUnit.SECONDS));
                for (int i = 0; i < 1000; i++) {
                    var snapshot = arena.findCurrentGameForUser(1L);
                    snapshot.getHintsUsed().forEach((id, hints) ->
                            assertEquals(hints.size() * 120L, snapshot.getPenaltiesInSeconds().get(id)));
                }
                return null;
            });
            start.countDown();
            for (var writer : writers) writer.get(10, TimeUnit.SECONDS);
            reader.get(10, TimeUnit.SECONDS);
            var snapshot = arena.getGameSession("game");
            assertEquals(500, snapshot.getHintsUsed().get(1L).size());
            assertEquals(500, snapshot.getHintsUsed().get(2L).size());
            arena.useHint("game", 1L, 501L);
            assertEquals(500, snapshot.getHintsUsed().get(1L).size());
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void concurrentFinishesAwardRatingsOnlyOnce() throws Exception {
        game();
        var executor = Executors.newFixedThreadPool(2);
        try {
            var first = executor.submit(() -> arena.finishGame("game", 1L));
            var second = executor.submit(() -> arena.finishGame("game", 2L));
            first.get(5, TimeUnit.SECONDS);
            second.get(5, TimeUnit.SECONDS);
            verify(users, times(2)).save(any(User.class));
            verify(chat, times(1)).cleanupChat("game");
            assertEquals("FINISHED", arena.getGameSession("game").getStatus());
        } finally {
            executor.shutdownNow();
        }
    }
}
