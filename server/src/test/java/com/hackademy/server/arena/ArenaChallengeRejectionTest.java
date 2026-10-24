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

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

class ArenaChallengeRejectionTest {
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
            when(users.findById(id)).thenReturn(Optional.of(user));
        }
        when(avatars.findDtosByUserIds(anyCollection())).thenReturn(Map.of());
        when(questions.drawForElo(anyInt(), anyInt(), any())).thenReturn(BattleEngineTest.questions(10));
        when(presence.isConnected(any())).thenReturn(true);
        arena.useClock(now::get);
        arena.useRandom(AnswerOrder.correctAt(2));
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
    void aRejectionLeavesANoticeOnlyForTheChallenger() {
        var sent = challenge(1, 2);
        now.addAndGet(5_000);
        signIn(2);
        assertEquals(200, controller.rejectChallenge(sent.getId()).getStatusCode().value());
        assertEquals("REJECTED", sent.getStatus());
        assertTrue(arena.getPendingChallenges(2L).isEmpty());
        assertTrue(arena.getOutgoingChallenges(1L).isEmpty());
        assertEquals(List.of(sent), arena.getRejectedChallenges(1L));
        assertTrue(arena.getRejectedChallenges(2L).isEmpty());
        assertTrue(arena.getExpiredChallenges(1L).isEmpty());
        verify(realtime, times(2)).arenaChanged(1L, 2L);
    }

    @Test
    void repeatingTheRejectionOrRejectingSomeoneElsesChallengeChangesNothing() {
        var sent = challenge(1, 2);
        arena.rejectChallenge(sent.getId(), 3L);
        arena.rejectChallenge(sent.getId(), 1L);
        assertEquals("PENDING", sent.getStatus());
        assertTrue(arena.getRejectedChallenges(1L).isEmpty());
        arena.rejectChallenge(sent.getId(), 2L);
        arena.rejectChallenge(sent.getId(), 2L);
        arena.rejectChallenge("missing", 2L);
        assertEquals(List.of(sent), arena.getRejectedChallenges(1L));
        verify(realtime, times(2)).arenaChanged(1L, 2L);
    }

    @Test
    void aRejectedChallengeNeverTurnsIntoAnExpiry() {
        var sent = challenge(1, 2);
        arena.rejectChallenge(sent.getId(), 2L);
        now.addAndGet(60_000);
        arena.expireChallenges();
        assertEquals("REJECTED", sent.getStatus());
        assertEquals(List.of(sent), arena.getRejectedChallenges(1L));
        assertTrue(arena.getExpiredChallenges(1L).isEmpty());
        verify(realtime, times(2)).arenaChanged(1L, 2L);
    }

    @Test
    void cancellingOrExpiringIsNotARejection() {
        var cancelled = challenge(1, 2);
        var expired = challenge(1, 3);
        var dropped = challenge(1, 4);
        arena.cancelChallenge(cancelled.getId(), 1L);
        arena.acceptChallenge(challenge(2, 4).getId(), 4L);
        now.addAndGet(60_000);
        arena.expireChallenges();
        assertEquals("CANCELLED", cancelled.getStatus());
        assertEquals("CANCELLED", dropped.getStatus());
        assertEquals("EXPIRED", expired.getStatus());
        assertTrue(arena.getRejectedChallenges(1L).isEmpty());
        assertEquals(List.of(expired), arena.getExpiredChallenges(1L));
    }

    @Test
    void actingOnARejectedChallengeExplainsThatItWasRejected() {
        var sent = challenge(1, 2);
        arena.rejectChallenge(sent.getId(), 2L);
        assertEquals(ArenaServiceImpl.REJECTED_CHALLENGE,
                assertThrows(IllegalArgumentException.class, () -> arena.acceptChallenge(sent.getId(), 2L)).getMessage());
        assertEquals(ArenaServiceImpl.REJECTED_CHALLENGE,
                assertThrows(IllegalArgumentException.class, () -> arena.cancelChallenge(sent.getId(), 1L)).getMessage());
        assertEquals(ArenaServiceImpl.STALE_CHALLENGE,
                assertThrows(IllegalArgumentException.class, () -> arena.acceptChallenge(sent.getId(), 3L)).getMessage());
        signIn(1);
        assertEquals(Map.of("message", ArenaServiceImpl.REJECTED_CHALLENGE), controller.cancelChallenge(sent.getId()).getBody());
        assertNull(arena.findActiveGameForUser(2L));
    }

    @Test
    void onlyTheChallengerCanDismissTheRejectionNotice() {
        var sent = challenge(1, 2);
        arena.rejectChallenge(sent.getId(), 2L);
        arena.dismissChallengeNotice(sent.getId(), 2L);
        assertEquals(List.of(sent), arena.getRejectedChallenges(1L));
        verify(realtime, never()).arenaChanged(2L);
        signIn(1);
        assertEquals(200, controller.dismissChallengeNotice(sent.getId()).getStatusCode().value());
        assertTrue(arena.getRejectedChallenges(1L).isEmpty());
        verify(realtime).arenaChanged(1L);
        arena.dismissChallengeNotice(sent.getId(), 1L);
        verify(realtime).arenaChanged(1L);
    }

    @Test
    void challengingTheSamePlayerAgainReplacesTheirRejectionNotice() {
        var first = challenge(1, 2);
        var other = challenge(1, 3);
        arena.rejectChallenge(first.getId(), 2L);
        arena.rejectChallenge(other.getId(), 3L);
        var second = challenge(1, 2);
        assertEquals(List.of(other), arena.getRejectedChallenges(1L));
        assertEquals(List.of(second), arena.getPendingChallenges(2L));
    }

    @Test
    void rejectionNoticesAreListedInTheOrderTheyHappenedAndFadeAfterFiveMinutes() {
        var later = challenge(1, 3);
        var sooner = challenge(1, 2);
        now.addAndGet(1_000);
        arena.rejectChallenge(sooner.getId(), 2L);
        now.addAndGet(1_000);
        arena.rejectChallenge(later.getId(), 3L);
        assertEquals(List.of(sooner, later), arena.getRejectedChallenges(1L));
        now.set(1_001_000 + ArenaServiceImpl.NOTICE_MILLIS - 1);
        arena.sweepAbandonedChallenges();
        assertEquals(List.of(sooner, later), arena.getRejectedChallenges(1L));
        now.incrementAndGet();
        arena.sweepAbandonedChallenges();
        assertEquals(List.of(later), arena.getRejectedChallenges(1L));
        verify(realtime).arenaChanged(1L);
    }

    @Test
    void aGameThatDropsTheChallengeMidRejectionLeavesNoRejectionNotice() throws Exception {
        var sent = challenge(1, 2);
        var rejecter = new AtomicReference<Thread>();
        var reads = new AtomicInteger();
        var paused = new CountDownLatch(1);
        var resume = new CountDownLatch(1);
        arena.useClock(() -> {
            if (Thread.currentThread() == rejecter.get() && reads.incrementAndGet() == 2) {
                paused.countDown();
                try {
                    assertTrue(resume.await(5, TimeUnit.SECONDS));
                } catch (InterruptedException interrupted) {
                    throw new IllegalStateException(interrupted);
                }
            }
            return now.get();
        });
        var thread = new Thread(() -> arena.rejectChallenge(sent.getId(), 2L));
        rejecter.set(thread);
        thread.start();
        assertTrue(paused.await(5, TimeUnit.SECONDS));
        var game = new GameSession();
        game.setId("queue-game");
        game.setPlayer1Id(2L);
        game.setPlayer1Username("player2");
        game.setPlayer2Id(3L);
        game.setPlayer2Username("player3");
        assertTrue(arena.addGame(game));
        resume.countDown();
        thread.join(5_000);
        assertEquals("CANCELLED", sent.getStatus());
        assertTrue(arena.getRejectedChallenges(1L).isEmpty());
        assertEquals(ArenaServiceImpl.STALE_CHALLENGE,
                assertThrows(IllegalArgumentException.class, () -> arena.cancelChallenge(sent.getId(), 1L)).getMessage());
        verify(realtime, times(1)).arenaChanged(1L, 2L);
    }
}
