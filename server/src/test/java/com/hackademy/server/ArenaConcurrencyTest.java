package com.hackademy.server;

import com.hackademy.server.arena.ArenaPresence;
import com.hackademy.server.arena.ArenaQuestion;
import com.hackademy.server.arena.ArenaQuestionRepository;
import com.hackademy.server.arena.ArenaServiceImpl;
import com.hackademy.server.arena.BattleEngine;
import com.hackademy.server.arena.Challenge;
import com.hackademy.server.arena.GameSession;
import com.hackademy.server.dashboard.DashboardSummaryCache;
import com.hackademy.server.friendship.FriendshipRepository;
import com.hackademy.server.realtime.RealtimeNotifier;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserAvatarRepository;
import com.hackademy.server.user.UserRepository;
import com.hackademy.server.user.UserServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.stream.LongStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

class ArenaConcurrencyTest {
    private final ArenaQuestionRepository questions = mock(ArenaQuestionRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final UserAvatarRepository avatars = mock(UserAvatarRepository.class);
    private final RealtimeNotifier realtime = mock(RealtimeNotifier.class);
    private final ArenaPresence presence = mock(ArenaPresence.class);
    private final ArenaServiceImpl arena = new ArenaServiceImpl(questions, mock(FriendshipRepository.class), users, avatars,
            mock(UserServiceImpl.class), mock(DashboardSummaryCache.class), realtime, presence, mock(com.hackademy.server.arena.MatchmakingService.class));

    static List<ArenaQuestion> questionSet() {
        return LongStream.rangeClosed(1, 10).mapToObj(id -> new ArenaQuestion(id, "Pytanie " + id,
                "A", "B", "C", "D", 1, "WEB", "EASY", 0L)).toList();
    }

    @BeforeEach
    void usersExist() {
        for (long id = 1; id <= 2; id++) {
            User user = new User();
            user.setId(id);
            user.setUsername("player" + id);
            user.setElo(500);
            when(users.findById(id)).thenReturn(Optional.of(user));
        }
        when(questions.findRandom(anyInt())).thenReturn(questionSet());
        when(avatars.findDtosByUserIds(anyCollection())).thenReturn(Map.of());
        when(presence.isConnected(any())).thenReturn(true);
    }

    private Challenge challenge() {
        return arena.createChallenge(1L, "player1", 2L, "player2");
    }

    @Test
    void acceptedChallengeStartsABattleWithoutRevealingAnswers() {
        var session = arena.acceptChallenge(challenge().getId(), 2L);
        assertEquals("ACTIVE", session.getStatus());
        assertEquals(1, session.getRound());
        assertEquals(10, session.getTotalRounds());
        assertEquals(Map.of(1L, 100, 2L, 100), session.getHp());
        assertEquals(List.of("A", "B", "C", "D"), session.getQuestion().answers());
        assertTrue(session.getQuestions().isEmpty());
        assertTrue(session.getChoices().isEmpty());
    }

    @Test
    void canceledAndRejectedChallengesCannotStartGames() {
        var canceled = challenge();
        arena.cancelChallenge(canceled.getId(), 1L);
        assertThrows(IllegalArgumentException.class, () -> arena.acceptChallenge(canceled.getId(), 2L));
        var rejected = challenge();
        arena.rejectChallenge(rejected.getId(), 2L);
        assertThrows(IllegalArgumentException.class, () -> arena.acceptChallenge(rejected.getId(), 2L));
        assertNull(arena.findCurrentGameForUser(1L));
    }

    @ParameterizedTest
    @ValueSource(strings = {"cancel", "reject", "accept"})
    void acceptingSerializesCompetingChallengeActions(String action) throws Exception {
        var challenge = challenge();
        var readingQuestions = new CountDownLatch(1);
        var releaseQuestions = new CountDownLatch(1);
        var competingStarted = new CountDownLatch(1);
        when(questions.findRandom(anyInt())).thenAnswer(invocation -> {
            readingQuestions.countDown();
            assertTrue(releaseQuestions.await(5, TimeUnit.SECONDS));
            return questionSet();
        });
        var executor = Executors.newFixedThreadPool(2);
        try {
            var accepted = executor.submit(() -> arena.acceptChallenge(challenge.getId(), 2L));
            assertTrue(readingQuestions.await(5, TimeUnit.SECONDS));
            var competing = executor.submit(() -> {
                competingStarted.countDown();
                switch (action) {
                    case "cancel" -> assertThrows(IllegalArgumentException.class,
                            () -> arena.cancelChallenge(challenge.getId(), 1L));
                    case "accept" -> assertThrows(IllegalArgumentException.class,
                            () -> arena.acceptChallenge(challenge.getId(), 2L));
                    case "reject" -> arena.rejectChallenge(challenge.getId(), 2L);
                    default -> fail("Unknown action");
                }
            });
            assertTrue(competingStarted.await(5, TimeUnit.SECONDS));
            assertThrows(TimeoutException.class, () -> competing.get(100, TimeUnit.MILLISECONDS));
            releaseQuestions.countDown();
            assertEquals(accepted.get(5, TimeUnit.SECONDS).getId(), arena.findCurrentGameForUser(1L).getId());
            competing.get(5, TimeUnit.SECONDS);
            verify(questions, times(1)).findRandom(BattleEngine.ROUNDS);
            assertTrue(arena.getOutgoingChallenges(1L).isEmpty());
        } finally {
            releaseQuestions.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void concurrentAcceptsStartExactlyOneGame() throws Exception {
        var challenge = challenge();
        var start = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var attempts = new ArrayList<Future<Boolean>>();
            for (int i = 0; i < 2; i++) attempts.add(executor.submit(() -> {
                assertTrue(start.await(5, TimeUnit.SECONDS));
                try {
                    arena.acceptChallenge(challenge.getId(), 2L);
                    return true;
                } catch (IllegalArgumentException invalid) {
                    return false;
                }
            }));
            start.countDown();
            int successes = 0;
            for (var attempt : attempts) if (attempt.get(5, TimeUnit.SECONDS)) successes++;
            assertEquals(1, successes);
            verify(questions, times(1)).findRandom(BattleEngine.ROUNDS);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void failedAcceptanceKeepsChallengeAvailableForRetry() {
        var challenge = challenge();
        when(questions.findRandom(anyInt())).thenReturn(List.of());
        assertThrows(IllegalStateException.class, () -> arena.acceptChallenge(challenge.getId(), 2L));
        assertEquals(1, arena.getPendingChallenges(2L).size());
        when(questions.findRandom(anyInt())).thenReturn(questionSet());
        assertNotNull(arena.acceptChallenge(challenge.getId(), 2L));
    }

    private void game() {
        var game = new GameSession();
        game.setId("game");
        game.setPlayer1Id(1L);
        game.setPlayer2Id(2L);
        game.setPlayer1Username("player1");
        game.setPlayer2Username("player2");
        arena.addGame(game);
    }

    @Test
    void simultaneousAnswersResolveTheRoundOnce() throws Exception {
        game();
        var executor = Executors.newFixedThreadPool(2);
        var start = new CountDownLatch(1);
        try {
            var answers = new ArrayList<Future<BattleEngine.AnswerResult>>();
            for (long id = 1; id <= 2; id++) {
                long userId = id;
                answers.add(executor.submit(() -> {
                    assertTrue(start.await(5, TimeUnit.SECONDS));
                    return arena.answer("game", userId, 1, 1);
                }));
            }
            start.countDown();
            for (var answer : answers) assertEquals(BattleEngine.AnswerResult.ACCEPTED, answer.get(5, TimeUnit.SECONDS));
            var snapshot = arena.getGameSession("game");
            assertEquals("REVEAL", snapshot.getPhase());
            assertEquals(Map.of(1L, 80, 2L, 80), snapshot.getHp());
            assertEquals(BattleEngine.AnswerResult.NOT_ACTIVE, arena.answer("game", 1L, 1, 1));
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void concurrentFinishesAwardRatingsOnlyOnce() throws Exception {
        game();
        var executor = Executors.newFixedThreadPool(2);
        try {
            var first = executor.submit(() -> arena.finishGame("game", 1L));
            var second = executor.submit(() -> arena.finishGame("game", 2L));
            first.get(5, TimeUnit.SECONDS);
            second.get(5, TimeUnit.SECONDS);
            verify(users, times(1)).saveAll(any());
            assertEquals("FINISHED", arena.getGameSession("game").getStatus());
        } finally {
            executor.shutdownNow();
        }
    }
}
