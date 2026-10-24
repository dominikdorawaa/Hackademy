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

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

class ArenaChallengeExpiryTest {
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

    private void at(long offset) {
        now.set(1_000_000 + offset);
        arena.expireChallenges();
    }

    @Test
    void aChallengeExpiresAfterSixtySecondsByDefaultOnBothSides() {
        var sent = challenge(1, 2);
        assertEquals(1_060_000, sent.getExpiresAt());
        at(59_999);
        assertEquals(List.of(sent), arena.getPendingChallenges(2L));
        assertEquals(List.of(sent), arena.getOutgoingChallenges(1L));
        at(60_000);
        assertEquals("EXPIRED", sent.getStatus());
        assertTrue(arena.getPendingChallenges(2L).isEmpty());
        assertTrue(arena.getOutgoingChallenges(1L).isEmpty());
        assertEquals(List.of(sent), arena.getExpiredChallenges(1L));
        assertTrue(arena.getExpiredChallenges(2L).isEmpty());
        verify(realtime, times(2)).arenaChanged(1L, 2L);
    }

    @Test
    void theExpiryTimeComesFromTheServerConfiguration() {
        arena.useChallengeExpiry(Duration.ofSeconds(15));
        var sent = challenge(1, 2);
        assertEquals(1_015_000, sent.getExpiresAt());
        at(14_999);
        assertEquals("PENDING", sent.getStatus());
        at(15_000);
        assertEquals("EXPIRED", sent.getStatus());
    }

    @Test
    void theConfiguredExpiryAcceptsSpringDurationText() {
        arena.useChallengeExpiry("90s");
        assertEquals(1_090_000, challenge(1, 2).getExpiresAt());
        arena.useChallengeExpiry("2m");
        assertEquals(1_120_000, challenge(1, 3).getExpiresAt());
        assertThrows(IllegalArgumentException.class, () -> arena.useChallengeExpiry("0s"));
        assertThrows(IllegalArgumentException.class, () -> arena.useChallengeExpiry("soon"));
    }

    @Test
    void anExpiryThatIsNotPositiveIsRefused() {
        assertThrows(IllegalArgumentException.class, () -> arena.useChallengeExpiry(Duration.ZERO));
        assertThrows(IllegalArgumentException.class, () -> arena.useChallengeExpiry(Duration.ofSeconds(-1)));
        assertThrows(IllegalArgumentException.class, () -> arena.useChallengeExpiry((Duration) null));
    }

    @Test
    void aChallengeCannotBeAcceptedOnceItsTimeIsUpEvenBeforeTheSweep() {
        var sent = challenge(1, 2);
        now.addAndGet(60_000);
        var refused = assertThrows(IllegalArgumentException.class, () -> arena.acceptChallenge(sent.getId(), 2L));
        assertEquals(ArenaServiceImpl.EXPIRED_CHALLENGE, refused.getMessage());
        assertEquals("EXPIRED", sent.getStatus());
        assertNull(arena.findActiveGameForUser(1L));
        assertNull(arena.findActiveGameForUser(2L));
        assertEquals(List.of(sent), arena.getExpiredChallenges(1L));
        assertEquals(ArenaServiceImpl.EXPIRED_CHALLENGE,
                assertThrows(IllegalArgumentException.class, () -> arena.acceptChallenge(sent.getId(), 2L)).getMessage());
        assertEquals(ArenaServiceImpl.STALE_CHALLENGE,
                assertThrows(IllegalArgumentException.class, () -> arena.acceptChallenge(sent.getId(), 3L)).getMessage());
        arena.expireChallenges();
        verify(realtime, times(2)).arenaChanged(1L, 2L);
    }

    @Test
    void aChallengeAcceptedInTimeStartsOneGameAndNeverExpires() {
        var sent = challenge(1, 2);
        at(59_999);
        var game = arena.acceptChallenge(sent.getId(), 2L);
        at(60_000);
        assertEquals("ACCEPTED", sent.getStatus());
        assertEquals(game.getId(), arena.findActiveGameForUser(1L).getId());
        assertTrue(arena.getExpiredChallenges(1L).isEmpty());
    }

    @Test
    void theSweepWaitsForAnAcceptanceThatStartedInTimeAndStartsNoSecondGame() throws Exception {
        var sent = challenge(1, 2);
        var inside = new CountDownLatch(1);
        var go = new CountDownLatch(1);
        User challenger = users.findById(1L).orElseThrow();
        when(users.findById(1L)).thenAnswer(invocation -> {
            inside.countDown();
            assertTrue(go.await(5, TimeUnit.SECONDS));
            return Optional.of(challenger);
        });
        now.addAndGet(59_999);
        var accepting = CompletableFuture.supplyAsync(() -> arena.acceptChallenge(sent.getId(), 2L));
        assertTrue(inside.await(5, TimeUnit.SECONDS));
        now.addAndGet(1);
        var sweep = new Thread(arena::expireChallenges);
        sweep.start();
        long waitUntil = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (sweep.getState() != Thread.State.BLOCKED && System.nanoTime() < waitUntil) Thread.onSpinWait();
        assertEquals(Thread.State.BLOCKED, sweep.getState());
        go.countDown();
        var game = accepting.get(5, TimeUnit.SECONDS);
        sweep.join(5_000);
        assertEquals("ACCEPTED", sent.getStatus());
        assertEquals(game.getId(), arena.findActiveGameForUser(2L).getId());
        assertTrue(arena.getExpiredChallenges(1L).isEmpty());
        assertThrows(IllegalArgumentException.class, () -> arena.acceptChallenge(sent.getId(), 2L));
    }

    @Test
    void rejectingOrCancellingInTimeIsNotAnExpiry() {
        var rejected = challenge(1, 2);
        var cancelled = challenge(1, 3);
        at(59_999);
        arena.rejectChallenge(rejected.getId(), 2L);
        arena.cancelChallenge(cancelled.getId(), 1L);
        at(60_000);
        assertEquals("REJECTED", rejected.getStatus());
        assertEquals("CANCELLED", cancelled.getStatus());
        assertTrue(arena.getExpiredChallenges(1L).isEmpty());
    }

    @Test
    void rejectingOrCancellingTooLateLeavesTheChallengeExpired() {
        var rejected = challenge(1, 2);
        var cancelled = challenge(1, 3);
        now.addAndGet(60_000);
        arena.rejectChallenge(rejected.getId(), 2L);
        assertEquals(ArenaServiceImpl.EXPIRED_CHALLENGE,
                assertThrows(IllegalArgumentException.class, () -> arena.cancelChallenge(cancelled.getId(), 1L)).getMessage());
        assertEquals("EXPIRED", rejected.getStatus());
        assertEquals("EXPIRED", cancelled.getStatus());
        assertEquals(List.of(rejected, cancelled).stream().map(Challenge::getId).sorted().toList(),
                arena.getExpiredChallenges(1L).stream().map(Challenge::getId).toList());
        assertEquals(ArenaServiceImpl.EXPIRED_CHALLENGE,
                assertThrows(IllegalArgumentException.class, () -> arena.cancelChallenge(cancelled.getId(), 1L)).getMessage());
        arena.rejectChallenge(rejected.getId(), 2L);
        assertEquals("EXPIRED", rejected.getStatus());
    }

    @Test
    void aChallengeDroppedByAnotherGameIsCancelledAndNeverExpires() {
        var dropped = challenge(1, 3);
        arena.acceptChallenge(challenge(4, 1).getId(), 1L);
        at(60_000);
        assertEquals("CANCELLED", dropped.getStatus());
        assertTrue(arena.getExpiredChallenges(1L).isEmpty());
        assertTrue(arena.getPendingChallenges(3L).isEmpty());
    }

    @Test
    void onlyTheChallengerCanDismissTheExpiryNotice() {
        var sent = challenge(1, 2);
        at(60_000);
        arena.dismissExpiredChallenge(sent.getId(), 2L);
        arena.dismissExpiredChallenge("missing", 1L);
        assertEquals(List.of(sent), arena.getExpiredChallenges(1L));
        verify(realtime, never()).arenaChanged(2L);
        signIn(1);
        assertEquals(200, controller.dismissExpiredChallenge(sent.getId()).getStatusCode().value());
        assertTrue(arena.getExpiredChallenges(1L).isEmpty());
        verify(realtime).arenaChanged(1L);
        assertEquals(ArenaServiceImpl.STALE_CHALLENGE,
                assertThrows(IllegalArgumentException.class, () -> arena.acceptChallenge(sent.getId(), 2L)).getMessage());
    }

    @Test
    void challengingTheSamePlayerAgainReplacesTheirExpiryNotice() {
        var first = challenge(1, 2);
        var other = challenge(1, 3);
        at(60_000);
        var second = challenge(1, 2);
        assertEquals(List.of(other), arena.getExpiredChallenges(1L));
        assertEquals(List.of(second), arena.getPendingChallenges(2L));
        assertNotEquals(first.getId(), second.getId());
        assertEquals(1_120_000, second.getExpiresAt());
    }

    @Test
    void theControllerExplainsThatAnExpiredChallengeCannotBeAccepted() {
        var sent = challenge(1, 2);
        at(60_000);
        signIn(2);
        var response = controller.acceptChallenge(sent.getId());
        assertEquals(400, response.getStatusCode().value());
        assertEquals(Map.of("message", ArenaServiceImpl.EXPIRED_CHALLENGE), response.getBody());
        assertNull(arena.findActiveGameForUser(2L));
    }

    @Test
    void expiryNoticesFadeAfterFiveMinutes() {
        var sent = challenge(1, 2);
        at(60_000);
        now.set(1_060_000 + ArenaServiceImpl.EXPIRED_NOTICE_MILLIS - 1);
        arena.sweepAbandonedChallenges();
        assertEquals(List.of(sent), arena.getExpiredChallenges(1L));
        now.incrementAndGet();
        arena.sweepAbandonedChallenges();
        assertTrue(arena.getExpiredChallenges(1L).isEmpty());
        verify(realtime).arenaChanged(1L);
    }

    @Test
    void onlyTheNewestExpiryNoticesAreKept() {
        for (long challenger = 100; challenger < 100 + ArenaServiceImpl.EXPIRED_NOTICES_KEPT; challenger++) {
            now.incrementAndGet();
            arena.createChallenge(challenger, "p" + challenger, 2L, "player2");
        }
        at(70_000);
        var newest = challenge(1, 2);
        at(130_000);
        arena.sweepAbandonedChallenges();
        assertTrue(arena.getExpiredChallenges(100L).isEmpty());
        assertEquals(1, arena.getExpiredChallenges(101L).size());
        assertEquals(List.of(newest), arena.getExpiredChallenges(1L));
    }
}
