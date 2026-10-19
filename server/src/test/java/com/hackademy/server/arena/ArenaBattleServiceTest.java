package com.hackademy.server.arena;

import com.hackademy.server.dashboard.DashboardSummaryCache;
import com.hackademy.server.friendship.FriendshipRepository;
import com.hackademy.server.realtime.RealtimeNotifier;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserAvatarRepository;
import com.hackademy.server.user.UserRepository;
import com.hackademy.server.user.UserServiceImpl;
import com.hackademy.server.user.dto.UserAvatarDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

class ArenaBattleServiceTest {
    private final ArenaQuestionRepository questions = mock(ArenaQuestionRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final UserAvatarRepository avatars = mock(UserAvatarRepository.class);
    private final RealtimeNotifier realtime = mock(RealtimeNotifier.class);
    private final ArenaPresence presence = mock(ArenaPresence.class);
    private final ArenaServiceImpl arena = new ArenaServiceImpl(questions, mock(FriendshipRepository.class), users, avatars,
            mock(UserServiceImpl.class), mock(DashboardSummaryCache.class), realtime, presence);
    private final AtomicLong now = new AtomicLong(10_000);
    private final Map<Long, User> players = new HashMap<>();
    private final UserAvatarDto avatar = new UserAvatarDto("dres", "kucyk", "brak", "jasna", "rude", "bialy", "granatowy", "czerwony", "bialy", "przod");

    @BeforeEach
    void setUp() {
        arena.useClock(now::get);
        for (long id = 1; id <= 2; id++) {
            User user = new User();
            user.setId(id);
            user.setUsername("player" + id);
            user.setElo(500);
            players.put(id, user);
            when(users.findById(id)).thenReturn(Optional.of(user));
        }
        when(questions.findRandom(anyInt())).thenReturn(BattleEngineTest.questions(10));
        when(avatars.findDtosByUserIds(anyCollection())).thenReturn(Map.of(1L, avatar));
        when(presence.isConnected(any())).thenReturn(true);
        var game = new GameSession();
        game.setId("game");
        game.setPlayer1Id(1L);
        game.setPlayer2Id(2L);
        arena.addGame(game);
    }

    private GameSession state() {
        return arena.getGameSession("game");
    }

    @Test
    void anAnswerDelayedPastTheRevealCannotAnswerTheNextQuestion() {
        now.addAndGet(BattleEngine.ROUND_MILLIS);
        arena.tickBattles();
        now.addAndGet(BattleEngine.REVEAL_MILLIS);
        arena.tickBattles();
        assertEquals(2, state().getRound());
        assertEquals(BattleEngine.AnswerResult.WRONG_ROUND, arena.answer("game", 1L, 1, 2));
        assertTrue(state().getAnsweredBy().isEmpty());
        assertEquals(Map.of(1L, 100, 2L, 100), state().getHp());
        assertEquals(BattleEngine.AnswerResult.ACCEPTED, arena.answer("game", 1L, 2, 0));
        assertEquals(BattleEngine.AnswerResult.ACCEPTED, arena.answer("game", 2L, 2, 0));
        assertEquals(Map.of(1L, 100, 2L, 100), state().getHp());
    }

    @Test
    void attachesSavedAvatarsToTheBattle() {
        assertEquals(avatar, state().getPlayer1Avatar());
        assertNull(state().getPlayer2Avatar());
        assertEquals("game", arena.findActiveGameForUser(2L).getId());
    }

    @Test
    void endsTheRoundWhenTimeRunsOutAndOpensTheNextAfterTheReveal() {
        arena.answer("game", 1L, state().getRound(), 2);
        now.addAndGet(BattleEngine.ROUND_MILLIS);
        arena.tickBattles();
        assertEquals("REVEAL", state().getPhase());
        assertEquals(Map.of(1L, 100, 2L, 80), state().getHp());
        now.addAndGet(BattleEngine.REVEAL_MILLIS);
        arena.tickBattles();
        assertEquals("QUESTION", state().getPhase());
        assertEquals(2, state().getRound());
        assertEquals(BattleEngine.AnswerResult.NOT_PLAYER, arena.answer("missing", 1L, state().getRound(), 0));
    }

    @Test
    void aKnockoutFinishesTheBattleAndAwardsElo() {
        for (int round = 1; round <= 5; round++) {
            arena.answer("game", 2L, state().getRound(), 2);
            arena.answer("game", 1L, state().getRound(), 0);
            now.addAndGet(BattleEngine.REVEAL_MILLIS);
            arena.tickBattles();
        }
        var finished = state();
        assertEquals("FINISHED", finished.getStatus());
        assertEquals(2L, finished.getWinnerId());
        assertEquals("KNOCKOUT", finished.getFinishReason());
        assertEquals(16, finished.getPlayer2EloChange());
        assertEquals(-16, finished.getPlayer1EloChange());
        verify(users).saveAll(List.of(players.get(2L), players.get(1L)));
        assertNull(arena.findActiveGameForUser(1L));
    }

    @Test
    void aDrawAfterTheLastRoundKeepsElo() {
        for (int round = 1; round <= 10; round++) {
            now.addAndGet(BattleEngine.ROUND_MILLIS);
            arena.tickBattles();
            now.addAndGet(BattleEngine.REVEAL_MILLIS);
            arena.tickBattles();
        }
        var finished = state();
        assertEquals("FINISHED", finished.getStatus());
        assertNull(finished.getWinnerId());
        assertEquals("ROUNDS", finished.getFinishReason());
        assertEquals(0, finished.getPlayer1EloChange());
        verify(users, never()).saveAll(any());
    }

    @Test
    void aPlayerAwayForThirtySecondsLoses() {
        when(presence.isConnected(2L)).thenReturn(false);
        arena.tickBattles();
        now.addAndGet(BattleEngine.DISCONNECT_MILLIS - 1);
        arena.tickBattles();
        assertEquals("ACTIVE", state().getStatus());
        now.addAndGet(1);
        arena.tickBattles();
        assertEquals("FINISHED", state().getStatus());
        assertEquals(1L, state().getWinnerId());
        assertEquals("DISCONNECT", state().getFinishReason());
    }

    @Test
    void reconnectingInTimeKeepsTheBattleGoing() {
        when(presence.isConnected(2L)).thenReturn(false);
        arena.tickBattles();
        now.addAndGet(BattleEngine.DISCONNECT_MILLIS - 1);
        when(presence.isConnected(2L)).thenReturn(true);
        arena.tickBattles();
        when(presence.isConnected(2L)).thenReturn(false);
        now.addAndGet(BattleEngine.DISCONNECT_MILLIS - 1);
        arena.tickBattles();
        assertEquals("ACTIVE", state().getStatus());
    }

    @Test
    void surrenderGivesTheWinToTheRivalOnlyForParticipants() {
        assertEquals(SurrenderResult.NOT_PLAYER, arena.surrenderGame("game", 3L));
        assertEquals("ACTIVE", state().getStatus());
        verify(users, never()).saveAll(any());
        assertEquals(SurrenderResult.SURRENDERED, arena.surrenderGame("game", 1L));
        assertEquals("SURRENDER", state().getFinishReason());
        assertEquals(2L, state().getWinnerId());
        assertEquals(SurrenderResult.NOT_ACTIVE, arena.surrenderGame("game", 2L));
        assertEquals(2L, state().getWinnerId());
        assertEquals(SurrenderResult.NOT_PLAYER, arena.surrenderGame("missing", 1L));
        arena.finishGame("missing", 1L);
    }

    @Test
    void reactionsReachOnlyTheGameAndKeepTheBattleUntouched() {
        var before = state();
        assertEquals(ReactionOutcome.Status.NOT_PLAYER, arena.react("game", 3L, "ez").status());
        assertEquals(ReactionOutcome.Status.NOT_PLAYER, arena.react("missing", 1L, "ez").status());
        assertEquals(ReactionOutcome.Status.UNKNOWN_REACTION, arena.react("game", 1L, "hello").status());
        assertEquals(ReactionOutcome.Status.UNKNOWN_REACTION, arena.react("game", 1L, null).status());
        assertEquals(ReactionOutcome.Status.UNKNOWN_REACTION, arena.react("game", 1L, "fire").status());
        assertEquals(List.of("ez", "gg", "laugh", "shock", "67", "groove"),
                Arrays.stream(QuickReaction.values()).map(QuickReaction::id).toList());
        assertEquals(ReactionOutcome.Status.SENT, arena.react("game", 1L, "67").status());
        var after = state();
        assertEquals(1, after.getReactions().size());
        var reaction = after.getReactions().get(0);
        assertEquals(1L, reaction.senderId());
        assertEquals("67", reaction.reaction());
        assertEquals(now.get(), reaction.sentAt());
        assertEquals(before.getRoundEndsAt(), after.getRoundEndsAt());
        assertEquals(before.getHp(), after.getHp());
        assertEquals(before.getAnsweredBy(), after.getAnsweredBy());
        verify(realtime, times(2)).changed(1L, 2L);
    }

    @Test
    void reactionsAreRateLimitedPerPlayer() {
        assertEquals(ReactionOutcome.Status.SENT, arena.react("game", 1L, "ez").status());
        var tooSoon = arena.react("game", 1L, "gg");
        assertEquals(ReactionOutcome.Status.TOO_FAST, tooSoon.status());
        assertEquals(ArenaServiceImpl.REACTION_GAP_MILLIS, tooSoon.retryAfterMillis());
        assertEquals(ReactionOutcome.Status.SENT, arena.react("game", 2L, "gg").status());
        for (int sent = 1; sent < ArenaServiceImpl.REACTION_WINDOW_LIMIT; sent++) {
            now.addAndGet(ArenaServiceImpl.REACTION_GAP_MILLIS);
            assertEquals(ReactionOutcome.Status.SENT, arena.react("game", 1L, "laugh").status());
        }
        now.addAndGet(ArenaServiceImpl.REACTION_GAP_MILLIS);
        var windowFull = arena.react("game", 1L, "laugh");
        assertEquals(ReactionOutcome.Status.TOO_FAST, windowFull.status());
        assertEquals(ArenaServiceImpl.REACTION_WINDOW_MILLIS - 5 * ArenaServiceImpl.REACTION_GAP_MILLIS, windowFull.retryAfterMillis());
        now.addAndGet(windowFull.retryAfterMillis());
        assertEquals(ReactionOutcome.Status.SENT, arena.react("game", 1L, "laugh").status());
        assertEquals(ArenaServiceImpl.REACTIONS_KEPT, state().getReactions().size() + 1);
    }

    @Test
    void onlyTheNewestReactionsAreKept() {
        for (int sent = 0; sent < ArenaServiceImpl.REACTIONS_KEPT + 3; sent++) {
            now.addAndGet(ArenaServiceImpl.REACTION_WINDOW_MILLIS);
            arena.react("game", 1L + sent % 2, "shock");
        }
        var reactions = state().getReactions();
        assertEquals(ArenaServiceImpl.REACTIONS_KEPT, reactions.size());
        assertTrue(reactions.get(0).id() < reactions.get(reactions.size() - 1).id());
    }

    @Test
    void mutedPlayersCannotReactUntilTheMuteEnds() {
        var muted = users.findById(1L).orElseThrow();
        muted.setMutedUntil(LocalDateTime.now(ZoneOffset.UTC).plusMinutes(5));
        var outcome = arena.react("game", 1L, "ez");
        assertEquals(ReactionOutcome.Status.MUTED, outcome.status());
        assertEquals(muted.getMutedUntil(), outcome.mutedUntil());
        assertTrue(state().getReactions().isEmpty());
        muted.setMutedUntil(LocalDateTime.now(ZoneOffset.UTC).minusMinutes(1));
        assertEquals(ReactionOutcome.Status.SENT, arena.react("game", 1L, "ez").status());
    }

    @Test
    void playersCanStillReactOnTheResultScreen() {
        arena.surrenderGame("game", 1L);
        assertEquals(ReactionOutcome.Status.SENT, arena.react("game", 2L, "gg").status());
        assertEquals("FINISHED", state().getStatus());
    }

    @Test
    void shuttingDownCancelsActiveBattlesWithoutChangingElo() {
        clearInvocations(realtime);
        arena.cancelActiveGames();
        var cancelled = state();
        assertEquals("FINISHED", cancelled.getStatus());
        assertEquals("CANCELLED", cancelled.getFinishReason());
        assertNull(cancelled.getWinnerId());
        assertEquals(0, cancelled.getPlayer1EloChange());
        assertEquals(0, cancelled.getPlayer2EloChange());
        verify(users, never()).saveAll(any());
        verify(realtime).changed(1L, 2L);
        assertNull(arena.findActiveGameForUser(1L));
    }

    @Test
    void shuttingDownLeavesSettledBattlesUntouched() {
        assertEquals(SurrenderResult.SURRENDERED, arena.surrenderGame("game", 1L));
        arena.cancelActiveGames();
        assertEquals("SURRENDER", state().getFinishReason());
        assertEquals(2L, state().getWinnerId());
        verify(users, times(1)).saveAll(any());
    }

    @Test
    void noBattleStartsWhileShuttingDown() {
        arena.cancelActiveGames();
        var late = new GameSession();
        late.setId("late");
        late.setPlayer1Id(1L);
        late.setPlayer2Id(2L);
        var error = assertThrows(IllegalStateException.class, () -> arena.addGame(late));
        assertEquals(ArenaServiceImpl.SHUTTING_DOWN, error.getMessage());
        assertNull(arena.getGameSession("late"));
    }

    @Test
    void acceptingAChallengeWhileShuttingDownIsRefused() {
        var challenge = arena.createChallenge(1L, "player1", 2L, "player2");
        arena.cancelActiveGames();
        var error = assertThrows(IllegalStateException.class, () -> arena.acceptChallenge(challenge.getId(), 2L));
        assertEquals(ArenaServiceImpl.SHUTTING_DOWN, error.getMessage());
        assertEquals("PENDING", challenge.getStatus());
    }

    @Test
    void closingTheApplicationCancelsActiveBattles() {
        var context = new AnnotationConfigApplicationContext();
        context.registerBean(ArenaQuestionRepository.class, () -> questions);
        context.registerBean(FriendshipRepository.class, () -> mock(FriendshipRepository.class));
        context.registerBean(UserRepository.class, () -> users);
        context.registerBean(UserAvatarRepository.class, () -> avatars);
        context.registerBean(UserServiceImpl.class, () -> mock(UserServiceImpl.class));
        context.registerBean(DashboardSummaryCache.class, () -> mock(DashboardSummaryCache.class));
        context.registerBean(RealtimeNotifier.class, () -> realtime);
        context.registerBean(ArenaPresence.class, () -> presence);
        context.registerBean(ArenaServiceImpl.class);
        context.refresh();
        var service = context.getBean(ArenaServiceImpl.class);
        var game = new GameSession();
        game.setId("live");
        game.setPlayer1Id(1L);
        game.setPlayer2Id(2L);
        service.addGame(game);
        context.close();
        assertEquals("CANCELLED", service.getGameSession("live").getFinishReason());
    }
}
