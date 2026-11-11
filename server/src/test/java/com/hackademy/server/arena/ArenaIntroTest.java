package com.hackademy.server.arena;

import com.hackademy.server.dashboard.DashboardSummaryCache;
import com.hackademy.server.friendship.FriendshipRepository;
import com.hackademy.server.ranking.RankingEntry;
import com.hackademy.server.realtime.RealtimeNotifier;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserAvatarRepository;
import com.hackademy.server.user.UserRepository;
import com.hackademy.server.user.UserServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

class ArenaIntroTest {
    private final ArenaQuestionRepository questions = mock(ArenaQuestionRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final UserAvatarRepository avatars = mock(UserAvatarRepository.class);
    private final ArenaPresence presence = mock(ArenaPresence.class);
    private final ArenaMatchRepository matches = mock(ArenaMatchRepository.class);
    private final UserServiceImpl userService = mock(UserServiceImpl.class);
    private final RealtimeNotifier realtime = mock(RealtimeNotifier.class);
    private final ArenaHistory history = new ArenaHistory(matches, users, userService);
    private final ArenaServiceImpl arena = new ArenaServiceImpl(questions, mock(FriendshipRepository.class), users, avatars,
            userService, mock(DashboardSummaryCache.class), realtime, presence, mock(MatchmakingService.class));
    private final AtomicLong now = new AtomicLong(10_000);

    @BeforeEach
    void setUp() {
        arena.useClock(now::get);
        arena.useRandom(AnswerOrder.correctAt(2));
        arena.useIntro(Duration.ofSeconds(7));
        arena.useHistory(history);
        for (long id = 1; id <= 2; id++) {
            User user = new User();
            user.setId(id);
            user.setUsername("player" + id);
            user.setElo(500);
            when(users.findById(id)).thenReturn(Optional.of(user));
        }
        when(users.countByEloGreaterThan(any())).thenReturn(4L);
        when(questions.drawForElo(anyInt(), anyInt(), any())).thenReturn(BattleEngineTest.questions(10));
        when(avatars.findDtosByUserIds(anyCollection())).thenReturn(Map.of());
        when(presence.isConnected(any())).thenReturn(true);
        when(matches.countResults(1L)).thenReturn(List.of(new Object[] {"WIN", 6L}, new Object[] {"LOSS", 2L}, new Object[] {"DRAW", 1L}));
        when(matches.findTop5ByUserIdOrderByIdDesc(1L)).thenReturn(List.of("WIN", "WIN", "LOSS", "WIN", "DRAW").stream().map(ArenaIntroTest::match).toList());
        when(matches.currentStreak(1L)).thenReturn(12L);
        when(userService.getUserRank(1L)).thenReturn(new RankingEntry(1, 5, "player1", 0, 500));
        when(userService.getUserRank(2L)).thenReturn(new RankingEntry(1, 9, "player2", 0, 500));
        var game = new GameSession();
        game.setId("game");
        game.setPlayer1Id(1L);
        game.setPlayer1Username("player1");
        game.setPlayer2Id(2L);
        game.setPlayer2Username("player2");
        arena.addGame(game);
    }

    private static ArenaMatch match(String result) {
        var match = new ArenaMatch();
        match.setResult(result);
        return match;
    }

    private GameSession state() {
        return arena.getGameSession("game");
    }

    @Test
    void introducesBothPlayersBeforeTheFirstQuestion() {
        assertEquals("INTRO", state().getPhase());
        assertEquals(0, state().getRound());
        assertNull(state().getQuestion());
        assertEquals(17_000, state().getNextRoundAt());
        assertEquals(new ArenaIntroCard(9, 6, 2, 12, List.of("WIN", "WIN", "LOSS", "WIN", "DRAW"), 5), state().getIntro().get(1L));
        assertEquals(ArenaIntroCard.EMPTY.games(), state().getIntro().get(2L).games());
        assertEquals(BattleEngine.AnswerResult.WRONG_ROUND, arena.answer("game", 1L, 1, 2));
        now.set(16_999);
        arena.tickBattles();
        assertEquals("INTRO", state().getPhase());
        now.set(17_000);
        arena.tickBattles();
        assertEquals("QUESTION", state().getPhase());
        assertEquals(1, state().getRound());
        assertEquals(17_000 + BattleEngine.ROUND_MILLIS, state().getRoundEndsAt());
        assertEquals(BattleEngine.AnswerResult.ACCEPTED, arena.answer("game", 1L, 1, 2));
    }

    @Test
    void recordsTheResultForEveryHumanPlayerOnceTheDuelEnds() {
        arena.finishGame("game", 1L);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ArenaMatch>> saved = ArgumentCaptor.forClass(List.class);
        verify(matches).saveAll(saved.capture());
        var results = saved.getValue().stream().collect(java.util.stream.Collectors.toMap(ArenaMatch::getUserId, ArenaMatch::getResult));
        assertEquals(Map.of(1L, "WIN", 2L, "LOSS"), results);
        assertEquals("player2", saved.getValue().stream().filter(match -> match.getUserId() == 1L).findFirst().orElseThrow().getOpponentName());
    }

    @Test
    void stillEndsTheDuelAndTellsBothPlayersWhenTheHistoryCannotBeSaved() {
        when(matches.saveAll(any())).thenThrow(new IllegalStateException("database down"));
        clearInvocations(realtime);
        arena.finishGame("game", 1L);
        assertEquals("FINISHED", state().getStatus());
        verify(realtime).changed(1L, 2L);
    }

    @Test
    void stampsTheEndOfTheDuelAndStillTakesReactionsOnTheVictoryStage() {
        now.set(30_000);
        arena.finishGame("game", 1L);
        assertEquals(30_000, state().getFinishedAt());
        now.set(32_000);
        assertEquals(ReactionOutcome.Status.SENT, arena.react("game", 1L, "scuba").status());
        assertEquals("scuba", state().getReactions().get(state().getReactions().size() - 1).reaction());
        assertTrue(state().getReactions().get(state().getReactions().size() - 1).sentAt() > state().getFinishedAt());
    }

    @Test
    void doesNotRecordCancelledDuels() {
        arena.cancelActiveGames();
        verify(matches, never()).saveAll(any());
    }

    @Test
    void givesBotsSteadyPlausibleRecords() {
        var card = history.botCard("cyfrowy_kruk", 540);
        assertEquals(card, history.botCard("cyfrowy_kruk", 540));
        var later = history.botCard("cyfrowy_kruk", 470);
        assertEquals(card.games(), later.games());
        assertEquals(card.recent(), later.recent());
        assertEquals(card.games(), card.wins() + card.losses());
        assertEquals(ArenaIntroCard.RECENT, card.recent().size());
        assertEquals(ArenaIntroCard.streakOf(card.recent()), card.streak());
        assertTrue(card.wins() > 0 && card.losses() > 0);
    }
}
