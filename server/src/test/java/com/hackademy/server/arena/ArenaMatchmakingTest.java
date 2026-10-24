package com.hackademy.server.arena;

import com.hackademy.server.dashboard.DashboardSummaryCache;
import com.hackademy.server.friendship.FriendshipRepository;
import com.hackademy.server.realtime.RealtimeNotifier;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserAvatarRepository;
import com.hackademy.server.user.UserRepository;
import com.hackademy.server.user.UserService;
import com.hackademy.server.user.UserServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

class ArenaMatchmakingTest {
    private final UserRepository users = mock(UserRepository.class);
    private final UserAvatarRepository avatars = mock(UserAvatarRepository.class);
    private final ArenaQuestionRepository questions = mock(ArenaQuestionRepository.class);
    private final RealtimeNotifier realtime = mock(RealtimeNotifier.class);
    private final UserService userService = mock(UserService.class);
    private final MatchmakingServiceImpl matchmaking = new MatchmakingServiceImpl(users, realtime);
    private final ArenaServiceImpl arena = new ArenaServiceImpl(questions, mock(FriendshipRepository.class), users, avatars,
            mock(UserServiceImpl.class), mock(DashboardSummaryCache.class), realtime, mock(ArenaPresence.class), matchmaking);
    private final ArenaController controller = new ArenaController(matchmaking, arena, userService);

    @BeforeEach
    void queuePlayers() {
        for (long id = 1; id <= 4; id++) {
            User user = new User();
            user.setId(id);
            user.setUsername("player" + id);
            user.setElo(500);
            when(users.findById(id)).thenReturn(Optional.of(user));
            matchmaking.joinQueue(id, user.getUsername());
        }
        when(avatars.findDtosByUserIds(anyCollection())).thenReturn(Map.of());
        when(questions.drawForElo(anyInt(), anyInt(), any())).thenReturn(BattleEngineTest.questions(10));
    }

    @AfterEach
    void clearUser() {
        SecurityContextHolder.clearContext();
    }

    private User signIn(long id) {
        User user = users.findById(id).orElseThrow();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, null, List.of()));
        return user;
    }

    @ParameterizedTest
    @ValueSource(strings = {"avatars", "questions", "empty"})
    void failedPreparationKeepsThePairQueuedAndDoesNotSkipTheOtherMatch(String failure) {
        switch (failure) {
            case "avatars" -> when(avatars.findDtosByUserIds(anyCollection()))
                    .thenThrow(new IllegalStateException("Unavailable avatars")).thenReturn(Map.of());
            case "questions" -> when(questions.drawForElo(anyInt(), anyInt(), any()))
                    .thenThrow(new IllegalStateException("Unavailable questions")).thenReturn(BattleEngineTest.questions(10));
            case "empty" -> when(questions.drawForElo(anyInt(), anyInt(), any()))
                    .thenReturn(List.of()).thenReturn(BattleEngineTest.questions(10));
            default -> fail("Unknown failure");
        }
        controller.processMatchmaking();
        assertTrue(matchmaking.isQueued(1L));
        assertTrue(matchmaking.isQueued(2L));
        assertNull(arena.findCurrentGameForUser(1L));
        assertNull(arena.findCurrentGameForUser(2L));
        assertFalse(matchmaking.isQueued(3L));
        assertFalse(matchmaking.isQueued(4L));
        String otherGame = arena.findCurrentGameForUser(3L).getId();
        assertEquals(otherGame, arena.findCurrentGameForUser(4L).getId());
        controller.processMatchmaking();
        assertFalse(matchmaking.isQueued(1L));
        assertFalse(matchmaking.isQueued(2L));
        assertNotNull(arena.findCurrentGameForUser(1L));
        assertEquals(arena.findCurrentGameForUser(1L).getId(), arena.findCurrentGameForUser(2L).getId());
        assertEquals(otherGame, arena.findCurrentGameForUser(3L).getId());
        verify(realtime, atLeastOnce()).arenaChanged(1L, 2L);
    }

    @Test
    void playersStayQueuedUntilThePreparedGameCanBePublished() {
        when(questions.drawForElo(anyInt(), anyInt(), any())).thenAnswer(invocation -> {
            long first = arena.findCurrentGameForUser(1L) == null ? 1L : 3L;
            long second = first + 1;
            assertTrue(matchmaking.isQueued(first));
            assertTrue(matchmaking.isQueued(second));
            return BattleEngineTest.questions(10);
        });
        controller.processMatchmaking();
        for (long id = 1; id <= 4; id++) {
            assertFalse(matchmaking.isQueued(id));
            assertNotNull(arena.findCurrentGameForUser(id));
        }
    }

    @Test
    void aWaitingPlayerCanLeaveOrRejoinAfterPreparationFails() {
        when(questions.drawForElo(anyInt(), anyInt(), any())).thenReturn(List.of());
        controller.processMatchmaking();
        User user = signIn(1L);
        assertEquals(204, controller.checkStatus().getStatusCode().value());
        assertEquals(200, controller.leaveQueue().getStatusCode().value());
        assertFalse(matchmaking.isQueued(1L));
        user.setPoints(0);
        assertEquals(200, controller.joinQueue().getStatusCode().value());
        assertTrue(matchmaking.isQueued(1L));
        assertEquals(204, controller.checkStatus().getStatusCode().value());
    }

    @Test
    void successfullyPreparedGamesAreVisibleOnlyToTheirParticipants() {
        controller.processMatchmaking();
        signIn(1L);
        GameSession game = (GameSession) controller.checkStatus().getBody();
        assertNotNull(game);
        assertEquals(200, controller.getGameStatus(game.getId()).getStatusCode().value());
        signIn(3L);
        assertEquals(404, controller.getGameStatus(game.getId()).getStatusCode().value());
        assertEquals(404, controller.getGameStatus("missing").getStatusCode().value());
    }

    @Test
    void aChallengeWhosePreparationFailedCanBeAcceptedAgain() {
        when(userService.getUserIdByUsername("player2")).thenReturn(2L);
        signIn(1L);
        assertEquals(200, controller.createChallenge(Map.of("targetUsername", "player2")).getStatusCode().value());
        signIn(2L);
        List<Challenge> pending = controller.getPendingChallenges().getBody();
        assertNotNull(pending);
        assertEquals(1, pending.size());
        String challengeId = pending.get(0).getId();
        when(questions.drawForElo(anyInt(), anyInt(), any())).thenReturn(List.of());
        assertEquals(400, controller.acceptChallenge(challengeId).getStatusCode().value());
        assertEquals(1, controller.getPendingChallenges().getBody().size());
        assertNull(arena.findCurrentGameForUser(1L));
        when(questions.drawForElo(anyInt(), anyInt(), any())).thenReturn(BattleEngineTest.questions(10));
        assertEquals(200, controller.acceptChallenge(challengeId).getStatusCode().value());
        assertTrue(controller.getPendingChallenges().getBody().isEmpty());
        assertNotNull(arena.findCurrentGameForUser(1L));
    }

    @Test
    void aFailedUserLookupDoesNotRemoveAnyWaitingPlayers() {
        when(users.findById(3L)).thenThrow(new IllegalStateException("Database unavailable"));
        assertThrows(IllegalStateException.class, controller::processMatchmaking);
        for (long id = 1; id <= 4; id++) {
            assertTrue(matchmaking.isQueued(id));
            assertNull(arena.findCurrentGameForUser(id));
        }
        User third = new User();
        third.setId(3L);
        third.setUsername("player3");
        third.setElo(500);
        doReturn(Optional.of(third)).when(users).findById(3L);
        controller.processMatchmaking();
        for (long id = 1; id <= 4; id++) assertNotNull(arena.findCurrentGameForUser(id));
    }
}
