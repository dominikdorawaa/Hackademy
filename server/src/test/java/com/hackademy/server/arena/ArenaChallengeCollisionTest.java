package com.hackademy.server.arena;

import com.hackademy.server.dashboard.DashboardSummaryCache;
import com.hackademy.server.friendship.FriendshipRepository;
import com.hackademy.server.realtime.RealtimeNotifier;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserAvatarRepository;
import com.hackademy.server.user.UserRepository;
import com.hackademy.server.user.UserService;
import com.hackademy.server.user.UserServiceImpl;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

class ArenaChallengeCollisionTest {
    private final UserRepository users = mock(UserRepository.class);
    private final UserAvatarRepository avatars = mock(UserAvatarRepository.class);
    private final ArenaQuestionRepository questions = mock(ArenaQuestionRepository.class);
    private final RealtimeNotifier realtime = mock(RealtimeNotifier.class);
    private final ArenaPresence presence = mock(ArenaPresence.class);
    private final MatchmakingServiceImpl matchmaking = new MatchmakingServiceImpl(users, realtime);
    private final ArenaServiceImpl arena = new ArenaServiceImpl(questions, mock(FriendshipRepository.class), users, avatars,
            mock(UserServiceImpl.class), mock(DashboardSummaryCache.class), realtime, presence, matchmaking);
    private final ArenaController controller = new ArenaController(matchmaking, arena, mock(UserService.class));
    private final AtomicLong now = new AtomicLong(1_000_000);

    @BeforeEach
    void playersExist() {
        for (long id = 1; id <= 4; id++) {
            User user = new User();
            user.setId(id);
            user.setUsername("player" + id);
            user.setElo(500);
            user.setPoints(1_000);
            when(users.findById(id)).thenReturn(Optional.of(user));
        }
        when(avatars.findDtosByUserIds(anyCollection())).thenReturn(Map.of());
        when(questions.findRandom(anyInt())).thenReturn(BattleEngineTest.questions(10));
        when(presence.isConnected(any())).thenReturn(true);
        arena.useClock(now::get);
    }

    @AfterEach
    void signOut() {
        SecurityContextHolder.clearContext();
    }

    private Challenge challenge(long from, long to) {
        return arena.createChallenge(from, "player" + from, to, "player" + to);
    }

    private void signIn(long id) {
        User user = users.findById(id).orElseThrow();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, null, List.of()));
    }

    @Test
    void aPendingChallengeDoesNotKeepThePlayerOutOfTheQueue() {
        challenge(1, 3);
        signIn(1);
        assertEquals(200, controller.joinQueue().getStatusCode().value());
        assertTrue(matchmaking.isQueued(1L));
    }

    @Test
    void aQueueMatchDropsEveryChallengeOfItsPlayers() {
        challenge(1, 3);
        challenge(4, 2);
        matchmaking.joinQueue(1L, "player1");
        matchmaking.joinQueue(2L, "player2");
        controller.processMatchmaking();
        assertNotNull(arena.findActiveGameForUser(1L));
        assertTrue(arena.getOutgoingChallenges(1L).isEmpty());
        assertTrue(arena.getPendingChallenges(3L).isEmpty());
        assertTrue(arena.getOutgoingChallenges(4L).isEmpty());
        verify(realtime).arenaChanged(3L, 4L);
    }

    @Test
    void acceptingAChallengeTakesBothPlayersOutOfTheQueueAndDropsTheirOtherChallenges() {
        var sent = challenge(1, 2);
        var other = challenge(1, 3);
        matchmaking.joinQueue(1L, "player1");
        signIn(2);
        assertEquals(200, controller.acceptChallenge(sent.getId()).getStatusCode().value());
        assertFalse(matchmaking.isQueued(1L));
        assertNotNull(arena.findActiveGameForUser(2L));
        assertEquals("CANCELLED", other.getStatus());
        assertTrue(arena.getPendingChallenges(3L).isEmpty());
    }

    @Test
    void aPlayerAlreadyInADuelIsDroppedFromTheQueueSoTheirPartnerStillGetsAMatch() {
        arena.acceptChallenge(challenge(1, 4).getId(), 4L);
        matchmaking.joinQueue(1L, "player1");
        matchmaking.joinQueue(2L, "player2");
        controller.processMatchmaking();
        assertFalse(matchmaking.isQueued(1L));
        assertTrue(matchmaking.isQueued(2L));
        matchmaking.joinQueue(3L, "player3");
        controller.processMatchmaking();
        assertEquals(arena.findActiveGameForUser(2L).getId(), arena.findActiveGameForUser(3L).getId());
    }

    @Test
    void aChallengeFromSomeoneWhoStartedAnotherGameCanNoLongerBeAccepted() {
        var late = challenge(1, 3);
        arena.acceptChallenge(challenge(4, 1).getId(), 1L);
        assertEquals(ArenaServiceImpl.STALE_CHALLENGE,
                assertThrows(IllegalArgumentException.class, () -> arena.acceptChallenge(late.getId(), 3L)).getMessage());
        assertTrue(arena.getPendingChallenges(3L).isEmpty());
        assertEquals("CANCELLED", late.getStatus());
        assertNull(arena.findActiveGameForUser(3L));
    }

    @Test
    void nobodyCanChallengeOrBeChallengedDuringAGame() {
        arena.acceptChallenge(challenge(1, 2).getId(), 2L);
        assertEquals("player2 jest już w pojedynku.",
                assertThrows(IllegalStateException.class, () -> challenge(3, 2)).getMessage());
        assertEquals(ArenaServiceImpl.YOU_ARE_PLAYING,
                assertThrows(IllegalStateException.class, () -> challenge(1, 3)).getMessage());
        signIn(1);
        assertEquals(400, controller.joinQueue().getStatusCode().value());
    }

    @Test
    void theSameChallengeCannotBeSentTwiceOrToOneself() {
        challenge(1, 2);
        assertThrows(IllegalStateException.class, () -> challenge(1, 2));
        assertThrows(IllegalArgumentException.class, () -> challenge(1, 1));
    }

    @Test
    void twoFriendsAcceptingAtOnceStartExactlyOneGame() throws Exception {
        var toTwo = challenge(1, 2);
        var toThree = challenge(1, 3);
        var go = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var attempts = new ArrayList<Future<Boolean>>();
            for (var accept : List.of(Map.entry(toTwo.getId(), 2L), Map.entry(toThree.getId(), 3L))) {
                attempts.add(executor.submit(() -> {
                    go.await();
                    try {
                        arena.acceptChallenge(accept.getKey(), accept.getValue());
                        return true;
                    } catch (IllegalStateException | IllegalArgumentException refused) {
                        return false;
                    }
                }));
            }
            go.countDown();
            int started = 0;
            for (var attempt : attempts) if (attempt.get(5, TimeUnit.SECONDS)) started++;
            assertEquals(1, started);
            assertNotNull(arena.findActiveGameForUser(1L));
            assertTrue(arena.getOutgoingChallenges(1L).isEmpty());
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void aChallengeFromSomeoneWhoLeftIsDroppedAfterAWhile() {
        challenge(1, 2);
        when(presence.isConnected(1L)).thenReturn(false);
        arena.sweepAbandonedChallenges();
        now.addAndGet(ArenaServiceImpl.PLAYER_GONE_MILLIS - 1);
        arena.sweepAbandonedChallenges();
        assertEquals(1, arena.getPendingChallenges(2L).size());
        now.addAndGet(1);
        arena.sweepAbandonedChallenges();
        assertTrue(arena.getPendingChallenges(2L).isEmpty());
    }

    @Test
    void aChallengeToSomeoneWhoLeftIsDroppedToo() {
        challenge(1, 2);
        when(presence.isConnected(2L)).thenReturn(false);
        arena.sweepAbandonedChallenges();
        now.addAndGet(ArenaServiceImpl.PLAYER_GONE_MILLIS);
        arena.sweepAbandonedChallenges();
        assertTrue(arena.getOutgoingChallenges(1L).isEmpty());
    }

    @Test
    void oneSideLeavingAfterTheOtherReturnsStartsItsOwnClock() {
        challenge(1, 2);
        when(presence.isConnected(1L)).thenReturn(false);
        arena.sweepAbandonedChallenges();
        now.addAndGet(25_000);
        when(presence.isConnected(1L)).thenReturn(true);
        when(presence.isConnected(2L)).thenReturn(false);
        arena.sweepAbandonedChallenges();
        now.addAndGet(5_000);
        arena.sweepAbandonedChallenges();
        assertEquals(1, arena.getPendingChallenges(2L).size());
        now.addAndGet(ArenaServiceImpl.PLAYER_GONE_MILLIS - 5_000);
        arena.sweepAbandonedChallenges();
        assertTrue(arena.getPendingChallenges(2L).isEmpty());
    }

    @Test
    void aFinishedGameFreesItsPlayersForNewChallenges() {
        var game = arena.acceptChallenge(challenge(1, 2).getId(), 2L);
        arena.finishGame(game.getId(), null);
        assertDoesNotThrow(() -> challenge(1, 2));
    }

    @Test
    void aChallengerWhoComesBackInTimeKeepsTheChallenge() {
        challenge(1, 2);
        when(presence.isConnected(1L)).thenReturn(false);
        arena.sweepAbandonedChallenges();
        when(presence.isConnected(1L)).thenReturn(true);
        now.addAndGet(ArenaServiceImpl.PLAYER_GONE_MILLIS);
        arena.sweepAbandonedChallenges();
        when(presence.isConnected(1L)).thenReturn(false);
        arena.sweepAbandonedChallenges();
        assertEquals(1, arena.getPendingChallenges(2L).size());
    }
}
