package com.hackademy.server.arena;

import com.hackademy.server.dashboard.DashboardSummaryCache;
import com.hackademy.server.friendship.FriendshipRepository;
import com.hackademy.server.realtime.RealtimeNotifier;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserAvatarRepository;
import com.hackademy.server.user.UserRepository;
import com.hackademy.server.user.UserServiceImpl;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

import static com.hackademy.server.arena.ArenaAbsence.Reason.DISCONNECTED;
import static com.hackademy.server.arena.ArenaAbsence.Reason.LEFT;
import static com.hackademy.server.arena.BattleEngine.AnswerResult.ACCEPTED;
import static com.hackademy.server.arena.BattleEngine.AnswerResult.FORFEITED;
import static com.hackademy.server.arena.BattleEngine.AnswerResult.PAUSED;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

class ArenaPauseTest {
    private static final long START = 10_000;

    private final ArenaQuestionRepository questions = mock(ArenaQuestionRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final UserAvatarRepository avatars = mock(UserAvatarRepository.class);
    private final RealtimeNotifier realtime = mock(RealtimeNotifier.class);
    private final Set<Long> offline = new HashSet<>();
    private final ArenaPresence presence = userId -> !offline.contains(userId);
    private final ArenaServiceImpl arena = new ArenaServiceImpl(questions, mock(FriendshipRepository.class), users, avatars,
            mock(UserServiceImpl.class), mock(DashboardSummaryCache.class), realtime, presence, mock(MatchmakingService.class));
    private final ArenaController controller = new ArenaController(mock(MatchmakingService.class), arena, null);
    private final AtomicLong now = new AtomicLong(START);

    @BeforeEach
    void setUp() {
        arena.useClock(now::get);
        arena.useRandom(AnswerOrder.correctAt(2));
        for (long id = 1; id <= 2; id++) {
            User user = new User();
            user.setId(id);
            user.setUsername("player" + id);
            user.setElo(500);
            when(users.findById(id)).thenReturn(Optional.of(user));
        }
        when(questions.drawForElo(anyInt(), anyInt(), any())).thenReturn(BattleEngineTest.questions(10));
        when(avatars.findDtosByUserIds(anyCollection())).thenReturn(Map.of());
        var game = new GameSession();
        game.setId("game");
        game.setPlayer1Id(1L);
        game.setPlayer2Id(2L);
        arena.addGame(game);
    }

    @AfterEach
    void clearUser() {
        SecurityContextHolder.clearContext();
    }

    private GameSession state() {
        return arena.getGameSession("game");
    }

    private void at(long offset) {
        now.set(START + offset);
        arena.tickBattles();
    }

    private void signIn(long id) {
        User user = new User();
        user.setId(id);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, null, List.of()));
    }

    @Test
    void aReturnAfterThreeSecondsResumesWithTheSameTimeLeft() {
        at(4_000);
        offline.add(2L);
        at(5_000);
        var paused = state();
        assertEquals(new ArenaPause(List.of(2L), START + 5_000, START + 15_000), paused.getPause());
        assertEquals(Map.of(2L, new ArenaAbsence(DISCONNECTED, START + 5_000)), paused.getAbsences());
        assertEquals(List.of(2L), paused.getPausesUsed());
        at(8_000);
        assertEquals(PAUSED, arena.answer("game", 1L, 1, 2));
        offline.remove(2L);
        at(8_000);
        var resumed = state();
        assertNull(resumed.getPause());
        assertTrue(resumed.getAbsences().isEmpty());
        assertEquals(START + BattleEngine.ROUND_MILLIS + 3_000, resumed.getRoundEndsAt());
        assertEquals(List.of(2L), resumed.getPausesUsed());
    }

    @Test
    void thePauseDoesNotCountTowardsTheAnswerTimeUsedForDamage() {
        at(2_000);
        offline.add(2L);
        at(2_000);
        offline.remove(2L);
        at(7_000);
        now.set(START + 9_999);
        assertEquals(ACCEPTED, arena.answer("game", 1L, 1, 2));
        now.set(START + 12_000);
        arena.answer("game", 2L, 1, 0);
        assertEquals(16, state().getLastRound().damage().get(2L));
    }

    @Test
    void stopsTheRoundClockAndRevealDuringThePause() {
        offline.add(1L);
        at(1_000);
        at(BattleEngine.ROUND_MILLIS + 5_000);
        assertEquals("QUESTION", state().getPhase());
        assertEquals(1, state().getRound());
        offline.remove(1L);
        at(BattleEngine.ROUND_MILLIS + 5_000);
        at(BattleEngine.ROUND_MILLIS + 9_000);
        assertEquals("QUESTION", state().getPhase());
        at(BattleEngine.ROUND_MILLIS + 10_000);
        assertEquals("REVEAL", state().getPhase());
        offline.add(2L);
        at(BattleEngine.ROUND_MILLIS + 11_000);
        at(BattleEngine.ROUND_MILLIS + 20_000);
        assertEquals("REVEAL", state().getPhase());
        assertEquals(1, state().getRound());
        offline.remove(2L);
        at(BattleEngine.ROUND_MILLIS + 20_000);
        assertEquals(START + BattleEngine.ROUND_MILLIS + 22_000, state().getNextRoundAt());
    }

    @Test
    void thePauseEndsAfterTenSecondsAndTheAbsenceClockKeepsRunning() {
        at(1_000);
        offline.add(2L);
        at(1_000);
        at(1_000 + BattleEngine.PAUSE_MILLIS - 1);
        assertNotNull(state().getPause());
        at(1_000 + BattleEngine.PAUSE_MILLIS + 200);
        var resumed = state();
        assertNull(resumed.getPause());
        assertEquals(START + BattleEngine.ROUND_MILLIS + BattleEngine.PAUSE_MILLIS, resumed.getRoundEndsAt());
        assertEquals(ArenaAbsence.Reason.DISCONNECTED, resumed.getAbsences().get(2L).reason());
        at(1_000 + BattleEngine.DISCONNECT_MILLIS - 1);
        assertEquals("ACTIVE", state().getStatus());
        at(1_000 + BattleEngine.DISCONNECT_MILLIS);
        var finished = state();
        assertEquals("FINISHED", finished.getStatus());
        assertEquals(1L, finished.getWinnerId());
        assertEquals("DISCONNECT", finished.getFinishReason());
        assertNull(finished.getPause());
    }

    @Test
    void aSecondDisconnectGivesNoNewPause() {
        offline.add(2L);
        at(1_000);
        offline.remove(2L);
        at(2_000);
        offline.add(2L);
        at(3_000);
        assertNull(state().getPause());
        assertEquals(new ArenaAbsence(DISCONNECTED, START + 3_000), state().getAbsences().get(2L));
        offline.remove(2L);
        at(4_000);
        offline.add(2L);
        at(5_000);
        assertNull(state().getPause());
        assertEquals(List.of(2L), state().getPausesUsed());
        assertEquals(START + BattleEngine.ROUND_MILLIS + 1_000, state().getRoundEndsAt());
    }

    @Test
    void anOverlappingDisconnectUsesBothPausesWithoutExtendingIt() {
        offline.add(1L);
        at(1_000);
        offline.add(2L);
        at(4_000);
        var both = state();
        assertEquals(new ArenaPause(List.of(1L, 2L), START + 1_000, START + 11_000), both.getPause());
        assertEquals(List.of(1L, 2L), both.getPausesUsed());
        offline.remove(1L);
        at(6_000);
        assertNotNull(state().getPause());
        offline.remove(2L);
        at(7_000);
        assertNull(state().getPause());
        offline.add(1L);
        at(8_000);
        assertNull(state().getPause());
    }

    @Test
    void theOtherPlayerKeepsTheirOwnPauseAfterTheFirstEnds() {
        offline.add(1L);
        at(1_000);
        at(11_000);
        assertNull(state().getPause());
        offline.add(2L);
        at(12_000);
        assertEquals(new ArenaPause(List.of(2L), START + 12_000, START + 22_000), state().getPause());
        offline.remove(2L);
        at(13_000);
        assertNull(state().getPause());
        assertEquals(new ArenaAbsence(DISCONNECTED, START + 1_000), state().getAbsences().get(1L));
    }

    @Test
    void bothPlayersAwayForThirtySecondsCancelTheMatchWithoutElo() {
        offline.add(1L);
        at(1_000);
        offline.add(2L);
        at(5_000);
        at(1_000 + BattleEngine.DISCONNECT_MILLIS);
        assertEquals("ACTIVE", state().getStatus());
        assertEquals(FORFEITED, arena.answer("game", 1L, state().getRound(), 2));
        at(5_000 + BattleEngine.DISCONNECT_MILLIS);
        var finished = state();
        assertEquals("FINISHED", finished.getStatus());
        assertNull(finished.getWinnerId());
        assertEquals("ABANDONED", finished.getFinishReason());
        assertEquals(0, finished.getPlayer1EloChange());
        assertEquals(0, finished.getPlayer2EloChange());
        verify(users, never()).saveAll(any());
    }

    @Test
    void aRivalWhoComesBackInTimeWinsAfterTheOtherForfeits() {
        offline.add(1L);
        at(1_000);
        offline.add(2L);
        at(5_000);
        at(1_000 + BattleEngine.DISCONNECT_MILLIS);
        offline.remove(1L);
        at(2_000 + BattleEngine.DISCONNECT_MILLIS);
        assertEquals("ACTIVE", state().getStatus());
        offline.remove(2L);
        at(3_000 + BattleEngine.DISCONNECT_MILLIS);
        var finished = state();
        assertEquals(2L, finished.getWinnerId());
        assertEquals("DISCONNECT", finished.getFinishReason());
    }

    @Test
    void theRoundEndingAtTheSameMomentIsResolvedBeforeThePause() {
        arena.answer("game", 1L, 1, 2);
        offline.add(2L);
        at(BattleEngine.ROUND_MILLIS);
        var reveal = state();
        assertEquals("REVEAL", reveal.getPhase());
        assertEquals(80, reveal.getHp().get(2L));
        assertEquals(new ArenaPause(List.of(2L), START + BattleEngine.ROUND_MILLIS, START + BattleEngine.ROUND_MILLIS + BattleEngine.PAUSE_MILLIS),
                reveal.getPause());
        offline.remove(2L);
        at(BattleEngine.ROUND_MILLIS + 4_000);
        assertEquals(START + BattleEngine.ROUND_MILLIS + BattleEngine.REVEAL_MILLIS + 4_000, state().getNextRoundAt());
        at(BattleEngine.ROUND_MILLIS + BattleEngine.REVEAL_MILLIS + 4_000);
        assertEquals(2, state().getRound());
    }

    @Test
    void anAnswerAfterTheDeadlineIsLateEvenWhenThePauseStartsLater() {
        now.set(START + BattleEngine.ROUND_MILLIS + 100);
        assertEquals(BattleEngine.AnswerResult.TOO_LATE, arena.answer("game", 1L, 1, 2));
        offline.add(1L);
        arena.tickBattles();
        assertEquals("REVEAL", state().getPhase());
        assertEquals(Map.of(1L, BattleEngine.NO_ANSWER, 2L, BattleEngine.NO_ANSWER), state().getLastRound().choices());
    }

    @Test
    void leavingTheBattleViewPausesAndComingBackResumes() {
        signIn(1L);
        assertEquals(HttpStatus.NO_CONTENT, controller.leaveView("game").getStatusCode());
        at(2_000);
        assertEquals(new ArenaPause(List.of(1L), START + 2_000, START + 12_000), state().getPause());
        assertEquals(new ArenaAbsence(LEFT, START + 2_000), state().getAbsences().get(1L));
        offline.add(1L);
        at(3_000);
        assertEquals(new ArenaAbsence(DISCONNECTED, START + 2_000), state().getAbsences().get(1L));
        offline.remove(1L);
        at(4_000);
        assertEquals(LEFT, state().getAbsences().get(1L).reason());
        assertEquals(HttpStatus.NO_CONTENT, controller.returnToView("game").getStatusCode());
        at(5_000);
        assertNull(state().getPause());
        assertTrue(state().getAbsences().isEmpty());
    }

    @Test
    void onlyPlayersOfARunningBattleCanLeaveIt() {
        signIn(3L);
        assertEquals(HttpStatus.NOT_FOUND, controller.leaveView("game").getStatusCode());
        assertEquals(HttpStatus.NOT_FOUND, controller.returnToView("game").getStatusCode());
        signIn(1L);
        assertEquals(HttpStatus.NOT_FOUND, controller.leaveView("missing").getStatusCode());
    }

    @Test
    void refusesAnswersDuringThePauseWithAClearMessage() {
        signIn(1L);
        offline.add(2L);
        at(1_000);
        var response = controller.answer("game", Map.of("answer", 2, "round", 1));
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals(Map.of("message", "Walka jest wstrzymana. Odpowiesz po wznowieniu."), response.getBody());
    }

    @Test
    void finishedBattlesIgnorePresence() {
        arena.surrenderGame("game", 1L);
        offline.add(1L);
        at(1_000);
        assertTrue(state().getAbsences().isEmpty());
        assertNull(state().getPause());
    }
}
