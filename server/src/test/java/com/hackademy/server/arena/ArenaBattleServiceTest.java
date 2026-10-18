package com.hackademy.server.arena;

import com.hackademy.server.chat.ChatService;
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
    private final ChatService chat = mock(ChatService.class);
    private final RealtimeNotifier realtime = mock(RealtimeNotifier.class);
    private final ArenaPresence presence = mock(ArenaPresence.class);
    private final ArenaServiceImpl arena = new ArenaServiceImpl(questions, mock(FriendshipRepository.class), users, avatars,
            chat, mock(UserServiceImpl.class), mock(DashboardSummaryCache.class), realtime, presence);
    private final AtomicLong now = new AtomicLong(10_000);
    private final UserAvatarDto avatar = new UserAvatarDto("dres", "kucyk", "brak", "jasna", "rude", "bialy", "granatowy", "czerwony", "bialy", "przod");

    @BeforeEach
    void setUp() {
        arena.useClock(now::get);
        for (long id = 1; id <= 2; id++) {
            User user = new User();
            user.setId(id);
            user.setUsername("player" + id);
            user.setElo(500);
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
        verify(users, times(2)).save(any(User.class));
        verify(chat).cleanupChat("game");
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
        verify(users, never()).save(any(User.class));
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
        arena.surrenderGame("game", 3L);
        assertEquals("ACTIVE", state().getStatus());
        arena.surrenderGame("game", 1L);
        assertEquals("SURRENDER", state().getFinishReason());
        assertEquals(2L, state().getWinnerId());
        arena.surrenderGame("missing", 1L);
        arena.finishGame("missing", 1L);
    }
}
