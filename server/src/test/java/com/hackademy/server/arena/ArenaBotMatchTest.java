package com.hackademy.server.arena;

import tools.jackson.databind.json.JsonMapper;
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

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.SplittableRandom;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.random.RandomGenerator;

import static com.hackademy.server.arena.BattleEngine.AnswerResult.ACCEPTED;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

class ArenaBotMatchTest {
    private static final long START = 1_000_000;

    private final UserRepository users = mock(UserRepository.class);
    private final UserAvatarRepository avatars = mock(UserAvatarRepository.class);
    private final ArenaQuestionRepository questions = mock(ArenaQuestionRepository.class);
    private final RealtimeNotifier realtime = mock(RealtimeNotifier.class);
    private final FriendshipRepository friendships = mock(FriendshipRepository.class);
    private final UserServiceImpl userServiceImpl = mock(UserServiceImpl.class);
    private final DashboardSummaryCache dashboard = mock(DashboardSummaryCache.class);
    private final Set<Long> offline = new HashSet<>();
    private final List<Long> askedAbout = new CopyOnWriteArrayList<>();
    private final ArenaPresence presence = userId -> {
        askedAbout.add(userId);
        return !offline.contains(userId);
    };
    private final MatchmakingServiceImpl matchmaking = new MatchmakingServiceImpl(users, realtime);
    private final ArenaServiceImpl arena = new ArenaServiceImpl(questions, friendships, users, avatars,
            userServiceImpl, dashboard, realtime, presence, matchmaking);
    private final ArenaController controller = new ArenaController(matchmaking, arena, mock(UserService.class));
    private final AtomicLong now = new AtomicLong(START);
    private final BotDice dice = new BotDice();
    private final MatchRandom matchRandom = new MatchRandom();
    private final Map<Long, User> accounts = new java.util.HashMap<>();

    static final class MatchRandom implements RandomGenerator {
        final Deque<Long> waits = new ArrayDeque<>();
        final List<int[]> ranges = new CopyOnWriteArrayList<>();
        private final SplittableRandom rest = new SplittableRandom(142);

        @Override
        public synchronized long nextLong() {
            return rest.nextLong();
        }

        @Override
        public synchronized long nextLong(long origin, long bound) {
            assertEquals(MatchmakingServiceImpl.BOT_WAIT_MIN_MILLIS, origin);
            assertEquals(MatchmakingServiceImpl.BOT_WAIT_MAX_MILLIS + 1, bound);
            return waits.isEmpty() ? MatchmakingServiceImpl.BOT_WAIT_MIN_MILLIS : waits.poll();
        }

        @Override
        public synchronized int nextInt(int origin, int bound) {
            ranges.add(new int[] {origin, bound});
            return rest.nextInt(origin, bound);
        }

        @Override
        public synchronized int nextInt(int bound) {
            return rest.nextInt(bound);
        }
    }

    @BeforeEach
    void setUp() {
        for (long id = 1; id <= 3; id++) {
            User user = new User();
            user.setId(id);
            user.setUsername("player" + id);
            user.setElo(500);
            user.setPoints(1_000);
            accounts.put(id, user);
            when(users.findById(id)).thenReturn(Optional.of(user));
        }
        when(avatars.findDtosByUserIds(anyCollection())).thenReturn(Map.of());
        when(questions.drawForElo(anyInt(), anyInt(), any())).thenReturn(BattleEngineTest.questions(10));
        matchmaking.useClock(now::get);
        matchmaking.useRandom(matchRandom);
        arena.useClock(now::get);
        arena.useRandom(dice);
    }

    @AfterEach
    void signOut() {
        SecurityContextHolder.clearContext();
    }

    private void signIn(long id) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(accounts.get(id), null, List.of()));
    }

    private int join(long id) {
        signIn(id);
        return controller.joinQueue().getStatusCode().value();
    }

    private void leave(long id) {
        signIn(id);
        assertEquals(200, controller.leaveQueue().getStatusCode().value());
    }

    private void at(long offset) {
        now.set(START + offset);
        controller.processMatchmaking();
        arena.tickBattles();
    }

    private GameSession game(long id) {
        return arena.findCurrentGameForUser(id);
    }

    private GameSession botGameAt(long offset) {
        matchRandom.waits.add(offset);
        assertEquals(200, join(1));
        at(offset - 1);
        assertNull(game(1));
        at(offset);
        GameSession session = game(1);
        assertNotNull(session);
        return session;
    }

    @Test
    void aLonePlayerMeetsABotWhenTheirDrawnFifteenSecondsPass() {
        matchRandom.waits.add(15_000L);
        assertEquals(200, join(1));
        at(14_999);
        assertNull(game(1));
        assertTrue(matchmaking.isQueued(1L));
        at(15_000);
        GameSession session = game(1);
        assertNotNull(session);
        assertEquals("ACTIVE", session.getStatus());
        assertEquals(1L, session.getPlayer1Id());
        assertTrue(session.getPlayer2Id() < 0);
        assertFalse(matchmaking.isQueued(1L));
        assertEquals(START + 15_000 + BattleEngine.ROUND_MILLIS, session.getRoundEndsAt());
    }

    @Test
    void theLatestDrawnDeadlineIsTwentySeconds() {
        matchRandom.waits.add(20_000L);
        join(1);
        at(19_999);
        assertNull(game(1));
        at(20_000);
        assertNotNull(game(1));
    }

    @Test
    void anAvailableHumanIsMatchedInsteadOfABot() {
        matchRandom.waits.addAll(List.of(15_000L, 15_000L));
        join(1);
        at(14_000);
        now.set(START + 15_000);
        join(2);
        GameSession session = game(1);
        assertEquals(2L, session.getPlayer2Id());
        assertEquals(session.getId(), game(2).getId());
        verify(users, never()).findByUsernameIgnoringCase(any());
    }

    @Test
    void aPlayerLeftOverAfterPairingGetsABotOnlyAtTheirOwnDeadline() {
        matchRandom.waits.addAll(List.of(15_000L, 15_000L, 17_000L));
        join(1);
        join(2);
        now.set(START + 1_000);
        join(3);
        at(17_999);
        assertNull(game(3));
        at(18_000);
        assertTrue(game(3).getPlayer2Id() < 0);
        assertEquals(2L, game(1).getPlayer2Id());
    }

    @Test
    void leavingTheQueueDropsTheDeadlineAndRejoiningDrawsANewOne() {
        matchRandom.waits.addAll(List.of(15_000L, 15_000L));
        join(1);
        now.set(START + 10_000);
        leave(1);
        at(15_000);
        assertNull(game(1));
        assertFalse(matchmaking.isQueued(1L));
        now.set(START + 12_000);
        join(1);
        at(26_999);
        assertNull(game(1));
        at(27_000);
        assertTrue(game(1).getPlayer2Id() < 0);
    }

    @Test
    void privateChallengesNeverTurnIntoBotDuels() {
        var challenge = arena.createChallenge(1L, "player1", 2L, "player2");
        for (long offset = 0; offset < ArenaServiceImpl.DEFAULT_CHALLENGE_EXPIRY.toMillis(); offset += 5_000) at(offset);
        assertNull(game(1));
        assertNull(game(2));
        GameSession session = arena.acceptChallenge(challenge.getId(), 2L);
        assertEquals(1L, session.getPlayer1Id());
        assertEquals(2L, session.getPlayer2Id());
        verify(users, never()).findByUsernameIgnoringCase(any());
    }

    @Test
    void theBotLooksLikeAPlayerButIsNeverTreatedAsAnAccount() throws Exception {
        GameSession session = botGameAt(15_000);
        Long bot = session.getPlayer2Id();
        assertNotNull(session.getPlayer2Username());
        assertFalse(session.getPlayer2Username().toLowerCase(Locale.ROOT).contains("bot"));
        assertNotNull(session.getPlayer2Avatar());
        assertTrue(session.getPlayer2Elo() >= 400 && session.getPlayer2Elo() <= 600);
        verify(users).findByUsernameIgnoringCase(session.getPlayer2Username());
        verify(avatars).findDtosByUserIds(List.of(1L));
        at(16_000);
        assertTrue(askedAbout.contains(1L));
        assertFalse(askedAbout.contains(bot));
        verify(users, never()).findById(bot);
        assertTrue(notifiedIds().stream().noneMatch(id -> id.equals(bot)));
        signIn(1);
        String json = JsonMapper.builder().build().writeValueAsString(controller.getGameStatus(session.getId()).getBody());
        assertFalse(json.toLowerCase(Locale.ROOT).replace("bottomcolor", "").contains("bot"), json);
        assertFalse(json.contains("ticket"), json);
        assertNull(arena.findActiveGameForUser(bot));
    }

    private List<Object> notifiedIds() {
        return mockingDetails(realtime).getInvocations().stream().flatMap(call -> Arrays.stream(call.getArguments()))
                .flatMap(argument -> argument instanceof Object[] many ? Arrays.stream(many) : java.util.stream.Stream.of(argument)).toList();
    }

    @Test
    void botEloIsDrawnAroundThePlayerAndNeverBelowZero() {
        accounts.get(1L).setElo(50);
        GameSession low = botGameAt(15_000);
        assertTrue(matchRandom.ranges.stream().anyMatch(range -> range[0] == 0 && range[1] == 151));
        assertTrue(low.getPlayer2Elo() >= 0 && low.getPlayer2Elo() <= 150);
        accounts.get(2L).setElo(1500);
        matchRandom.waits.add(15_000L);
        now.set(START + 20_000);
        join(2);
        at(35_000);
        GameSession high = game(2);
        assertTrue(matchRandom.ranges.stream().anyMatch(range -> range[0] == 1400 && range[1] == 1601));
        assertTrue(high.getPlayer2Elo() >= 1400 && high.getPlayer2Elo() <= 1600);
        assertNotEquals(low.getPlayer2Id(), high.getPlayer2Id());
    }

    @Test
    void theBotAnswersAtItsDrawnTimeAndItsDamageDependsOnThatTime() {
        dice.move(BotDice.CORRECT, 5_000);
        GameSession session = botGameAt(15_000);
        Long bot = session.getPlayer2Id();
        at(15_000 + 4_999);
        assertTrue(game(1).getAnsweredBy().isEmpty());
        at(15_000 + 5_200);
        assertEquals(List.of(bot), game(1).getAnsweredBy());
        now.set(START + 15_000 + 6_000);
        assertEquals(ACCEPTED, arena.answer(session.getId(), 1L, 1, 2));
        RoundResult round = game(1).getLastRound();
        assertEquals(2, round.choices().get(bot));
        assertEquals(15, round.damage().get(1L));
        assertEquals(14, round.damage().get(bot));
    }

    @Test
    void aWrongBotAnswerDealsNoDamage() {
        dice.move(BotDice.WRONG, 3_000);
        dice.wrongPicks.add(2);
        GameSession session = botGameAt(15_000);
        at(18_000);
        now.set(START + 19_000);
        arena.answer(session.getId(), 1L, 1, 0);
        RoundResult round = game(1).getLastRound();
        assertEquals(3, round.choices().get(session.getPlayer2Id()));
        assertEquals(0, round.damage().get(1L));
    }

    @Test
    void aPauseHoldsTheBotAnswerAndKeepsTheSameDamage() {
        dice.move(BotDice.CORRECT, 5_000);
        GameSession session = botGameAt(15_000);
        Long bot = session.getPlayer2Id();
        offline.add(1L);
        at(18_000);
        assertEquals(new ArenaPause(List.of(1L), START + 18_000, START + 28_000), game(1).getPause());
        at(20_000);
        assertTrue(game(1).getAnsweredBy().isEmpty());
        offline.remove(1L);
        at(22_000);
        assertNull(game(1).getPause());
        at(23_999);
        assertTrue(game(1).getAnsweredBy().isEmpty());
        at(24_000);
        assertEquals(List.of(bot), game(1).getAnsweredBy());
        now.set(START + 25_000);
        assertEquals(ACCEPTED, arena.answer(session.getId(), 1L, 1, 2));
        RoundResult round = game(1).getLastRound();
        assertEquals(15, round.damage().get(1L));
        assertEquals(14, round.damage().get(bot));
        assertFalse(game(1).getAbsences().containsKey(bot));
        assertFalse(game(1).getPausesUsed().contains(bot));
    }

    @Test
    void aPauseThatRunsOutDelaysTheBotByTheWholeTenSeconds() {
        dice.move(BotDice.CORRECT, 5_000);
        GameSession session = botGameAt(15_000);
        signIn(1);
        controller.leaveView(session.getId());
        at(18_000);
        at(27_999);
        assertNotNull(game(1).getPause());
        at(28_000);
        assertNull(game(1).getPause());
        at(29_999);
        assertTrue(game(1).getAnsweredBy().isEmpty());
        at(30_000);
        assertEquals(List.of(session.getPlayer2Id()), game(1).getAnsweredBy());
    }

    @Test
    void aPlayerWhoStaysAwayLosesToTheBotAndPaysEloOnce() {
        GameSession session = botGameAt(15_000);
        int botElo = session.getPlayer2Elo();
        signIn(1);
        controller.leaveView(session.getId());
        for (long offset = 15_250; offset < 45_250; offset += 250) at(offset);
        assertEquals("ACTIVE", game(1).getStatus());
        at(45_250);
        GameSession finished = game(1);
        assertEquals("FINISHED", finished.getStatus());
        assertEquals("DISCONNECT", finished.getFinishReason());
        assertEquals(session.getPlayer2Id(), finished.getWinnerId());
        int[] expected = ArenaServiceImpl.eloChanges(botElo, 500);
        assertEquals(expected[1], finished.getPlayer1EloChange());
        assertEquals(500 + expected[1], accounts.get(1L).getElo());
        at(60_000);
        verify(users, times(1)).save(accounts.get(1L));
    }

    @Test
    void beatingTheBotRaisesEloAgainstItsDrawnEloAndSettlesOnlyOnce() {
        for (int round = 0; round < 5; round++) dice.move(BotDice.WRONG, 5_000);
        GameSession session = botGameAt(15_000);
        int botElo = session.getPlayer2Elo();
        long opened = 15_000;
        for (int round = 1; round <= 5; round++) {
            now.set(START + opened);
            assertEquals(ACCEPTED, arena.answer(session.getId(), 1L, round, 2));
            at(opened + 5_000);
            opened += 5_000 + BattleEngine.REVEAL_MILLIS;
            at(opened);
        }
        GameSession finished = game(1);
        assertEquals("KNOCKOUT", finished.getFinishReason());
        assertEquals(1L, finished.getWinnerId());
        int[] expected = ArenaServiceImpl.eloChanges(500, botElo);
        assertEquals(expected[0], finished.getPlayer1EloChange());
        assertEquals(expected[1], finished.getPlayer2EloChange());
        assertEquals(500 + expected[0], accounts.get(1L).getElo());
        assertEquals(SurrenderResult.NOT_ACTIVE, arena.surrenderGame(session.getId(), 1L));
        arena.finishGame(session.getId(), session.getPlayer2Id());
        verify(users, times(1)).save(accounts.get(1L));
        verify(users, never()).saveAll(any());
        verifyNoInteractions(friendships);
        verify(userServiceImpl).invalidateUserComputedCaches(1L);
        verify(userServiceImpl).invalidateGlobalRankingCache();
        verify(dashboard).invalidateUser(1L);
        verify(userServiceImpl, never()).invalidateUserComputedCaches(session.getPlayer2Id());
    }

    @Test
    void surrenderingToTheBotCostsEloLikeAnyLoss() {
        accounts.get(1L).setElo(900);
        GameSession session = botGameAt(15_000);
        int botElo = session.getPlayer2Elo();
        assertEquals(SurrenderResult.SURRENDERED, arena.surrenderGame(session.getId(), 1L));
        int[] expected = ArenaServiceImpl.eloChanges(botElo, 900);
        assertEquals(900 + expected[1], accounts.get(1L).getElo());
        assertEquals(expected[1], game(1).getPlayer1EloChange());
        assertTrue(expected[1] < 0);
    }

    @Test
    void aDrawOrShutdownLeavesEloUntouched() {
        GameSession session = botGameAt(15_000);
        arena.cancelActiveGames();
        assertEquals("CANCELLED", game(1).getFinishReason());
        assertEquals(0, game(1).getPlayer1EloChange());
        verify(users, never()).save(any());
        assertNotNull(session);
    }

    @Test
    void aBotDuelCannotSettleWhenThePlayerAccountIsGone() {
        GameSession session = botGameAt(15_000);
        when(users.findById(1L)).thenReturn(Optional.empty());
        arena.surrenderGame(session.getId(), 1L);
        assertEquals(0, game(1).getPlayer1EloChange());
        verify(users, never()).save(any());
    }

    @Test
    void leavingTheQueueWhileTheBotDuelIsPreparedCancelsIt() {
        matchRandom.waits.add(15_000L);
        join(1);
        when(questions.drawForElo(anyInt(), anyInt(), any())).thenAnswer(invocation -> {
            leave(1);
            return BattleEngineTest.questions(10);
        });
        at(15_000);
        assertNull(game(1));
        assertNull(arena.findActiveGameForUser(1L));
        assertFalse(matchmaking.isQueued(1L));
        when(questions.drawForElo(anyInt(), anyInt(), any())).thenReturn(BattleEngineTest.questions(10));
        matchRandom.waits.add(15_000L);
        now.set(START + 16_000);
        assertEquals(200, join(1));
        at(30_999);
        assertNull(game(1));
        at(31_000);
        assertNotNull(game(1));
    }

    @Test
    void aBotDuelFoundBeforeTheyLeftAndRejoinedDoesNotStart() {
        matchRandom.waits.addAll(List.of(15_000L, 15_000L));
        join(1);
        now.set(START + 15_000);
        List<GameSession> found = matchmaking.checkForMatches();
        assertEquals(1, found.size());
        leave(1);
        join(1);
        assertFalse(arena.addGame(found.get(0)));
        matchmaking.releaseMatch(found.get(0));
        assertNull(game(1));
        assertTrue(matchmaking.isQueued(1L));
        at(29_999);
        assertNull(game(1));
        at(30_000);
        assertNotNull(game(1));
    }

    @Test
    void anAcceptedChallengeWinsOverABotThatIsNotStartedYet() {
        matchRandom.waits.add(15_000L);
        join(1);
        var challenge = arena.createChallenge(2L, "player2", 1L, "player1");
        now.set(START + 15_000);
        GameSession duel = arena.acceptChallenge(challenge.getId(), 1L);
        assertFalse(matchmaking.isQueued(1L));
        at(15_000);
        assertEquals(duel.getId(), game(1).getId());
        assertEquals(2L, game(1).getPlayer1Id());
        verify(users, never()).findByUsernameIgnoringCase(any());
    }

    @Test
    void aChallengeAcceptedWhileTheBotDuelStartsIsRefusedAndDropped() {
        matchRandom.waits.add(15_000L);
        join(1);
        var challenge = arena.createChallenge(2L, "player2", 1L, "player1");
        List<RuntimeException> refused = new ArrayList<>();
        when(questions.drawForElo(anyInt(), anyInt(), any())).thenAnswer(invocation -> {
            try {
                arena.acceptChallenge(challenge.getId(), 1L);
            } catch (RuntimeException error) {
                refused.add(error);
            }
            return BattleEngineTest.questions(10);
        });
        at(15_000);
        assertEquals(1, refused.size());
        assertEquals(ArenaServiceImpl.YOU_ARE_PLAYING, refused.get(0).getMessage());
        assertTrue(game(1).getPlayer2Id() < 0);
        assertEquals("CANCELLED", challenge.getStatus());
        assertTrue(arena.getPendingChallenges(1L).isEmpty());
        assertNull(game(2));
    }

    @Test
    void aHumanArrivingWhileTheBotDuelStartsWaitsForTheirOwnMatch() {
        matchRandom.waits.addAll(List.of(15_000L, 15_000L));
        join(1);
        when(questions.drawForElo(anyInt(), anyInt(), any())).thenAnswer(invocation -> {
            if (!matchmaking.isQueued(2L)) assertEquals(200, join(2));
            return BattleEngineTest.questions(10);
        });
        at(15_000);
        GameSession botDuel = game(1);
        assertTrue(botDuel.getPlayer2Id() < 0);
        assertTrue(matchmaking.isQueued(2L));
        assertNull(game(2));
        assertEquals(400, join(1));
        at(29_999);
        assertNull(game(2));
        assertEquals(botDuel.getId(), game(1).getId());
        assertEquals(botDuel.getPlayer2Id(), game(1).getPlayer2Id());
        at(30_000);
        assertTrue(game(2).getPlayer2Id() < 0);
        assertNotEquals(botDuel.getId(), game(2).getId());
    }

    @Test
    void aPlayerWhoseAccountCannotBeReadKeepsWaitingForTheNextCheck() {
        matchRandom.waits.add(15_000L);
        join(1);
        when(users.findById(1L)).thenReturn(Optional.empty());
        at(15_000);
        assertNull(game(1));
        assertTrue(matchmaking.isQueued(1L));
        when(users.findById(1L)).thenReturn(Optional.of(accounts.get(1L)));
        at(15_500);
        assertTrue(game(1).getPlayer2Id() < 0);
    }

    @Test
    void aFailedBotNameDrawKeepsThePlayerQueuedForTheNextCheck() {
        matchRandom.waits.add(15_000L);
        join(1);
        when(users.findByUsernameIgnoringCase(any())).thenReturn(Optional.of(accounts.get(2L)));
        now.set(START + 15_000);
        assertThrows(IllegalStateException.class, controller::processMatchmaking);
        assertNull(game(1));
        assertTrue(matchmaking.isQueued(1L));
        when(users.findByUsernameIgnoringCase(any())).thenReturn(Optional.empty());
        at(15_500);
        assertTrue(game(1).getPlayer2Id() < 0);
    }

    @Test
    void parallelMatchmakingStartsExactlyOneBotDuel() throws Exception {
        matchRandom.waits.add(15_000L);
        join(1);
        now.set(START + 15_000);
        var pool = Executors.newFixedThreadPool(8);
        var ready = new CountDownLatch(8);
        var go = new CountDownLatch(1);
        Collection<Throwable> failures = new CopyOnWriteArrayList<>();
        for (int thread = 0; thread < 8; thread++) {
            pool.submit(() -> {
                ready.countDown();
                try {
                    go.await();
                    controller.processMatchmaking();
                } catch (Throwable failure) {
                    failures.add(failure);
                }
            });
        }
        ready.await();
        go.countDown();
        pool.shutdown();
        assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS));
        assertTrue(failures.isEmpty(), failures.toString());
        verify(questions, times(1)).drawForElo(anyInt(), anyInt(), any());
        assertTrue(game(1).getPlayer2Id() < 0);
    }

    @Test
    void theQuestionDrawUsesTheAverageOfThePlayerAndTheBot() {
        accounts.get(1L).setElo(1000);
        GameSession session = botGameAt(15_000);
        verify(questions).drawForElo(eq(QuestionDraw.averageElo(1000, session.getPlayer2Elo())), eq(BattleEngine.ROUNDS), any());
    }
}
