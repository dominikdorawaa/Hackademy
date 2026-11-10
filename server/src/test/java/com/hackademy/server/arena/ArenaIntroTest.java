package com.hackademy.server.arena;

import com.hackademy.server.dashboard.DashboardSummaryCache;
import com.hackademy.server.friendship.FriendshipRepository;
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
    private final ArenaHistory history = new ArenaHistory(matches, users);
    private final ArenaServiceImpl arena = new ArenaServiceImpl(questions, mock(FriendshipRepository.class), users, avatars,
            mock(UserServiceImpl.class), mock(DashboardSummaryCache.class), mock(RealtimeNotifier.class), presence, mock(MatchmakingService.class));
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
        when(matches.countByUserId(1L)).thenReturn(9L);
        when(matches.countByUserIdAndResult(1L, "WIN")).thenReturn(6L);
        when(matches.countByUserIdAndResult(1L, "LOSS")).thenReturn(2L);
        when(matches.findTop10ByUserIdOrderByFinishedAtDescIdDesc(1L)).thenReturn(List.of("WIN", "WIN", "LOSS", "WIN", "DRAW", "WIN", "WIN").stream().map(ArenaIntroTest::match).toList());
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
        assertEquals(new ArenaIntroCard(9, 6, 2, 2, List.of("WIN", "WIN", "LOSS", "WIN", "DRAW"), 5), state().getIntro().get(1L));
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
        var saved = ArgumentCaptor.forClass(ArenaMatch.class);
        verify(matches, times(2)).save(saved.capture());
        var results = saved.getAllValues().stream().collect(java.util.stream.Collectors.toMap(ArenaMatch::getUserId, ArenaMatch::getResult));
        assertEquals(Map.of(1L, "WIN", 2L, "LOSS"), results);
        assertEquals("player2", saved.getAllValues().stream().filter(match -> match.getUserId() == 1L).findFirst().orElseThrow().getOpponentName());
    }

    @Test
    void doesNotRecordCancelledDuels() {
        arena.cancelActiveGames();
        verify(matches, never()).save(any());
    }

    @Test
    void givesBotsSteadyPlausibleRecords() {
        var card = history.botCard("cyfrowy_kruk", 540);
        assertEquals(card, history.botCard("cyfrowy_kruk", 540));
        assertEquals(card.games(), card.wins() + card.losses());
        assertEquals(ArenaIntroCard.RECENT, card.recent().size());
        assertEquals(ArenaIntroCard.streakOf(card.recent()), card.streak());
        assertTrue(card.wins() > 0 && card.losses() > 0);
    }
}
