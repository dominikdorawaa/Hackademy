package com.hackademy.server.arena;

import com.hackademy.server.dashboard.DashboardSummaryCache;
import com.hackademy.server.friendship.Friendship;
import com.hackademy.server.friendship.FriendshipRepository;
import com.hackademy.server.friendship.FriendshipStatus;
import com.hackademy.server.realtime.RealtimeNotifier;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserAvatarRepository;
import com.hackademy.server.user.UserRepository;
import com.hackademy.server.user.UserServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

class ArenaSettlementTest {
    private final UserRepository users = mock(UserRepository.class);
    private final UserAvatarRepository avatars = mock(UserAvatarRepository.class);
    private final ArenaQuestionRepository questions = mock(ArenaQuestionRepository.class);
    private final FriendshipRepository friendships = mock(FriendshipRepository.class);
    private final ArenaPresence presence = mock(ArenaPresence.class);
    private final ArenaServiceImpl arena = new ArenaServiceImpl(questions, friendships, users, avatars,
            mock(UserServiceImpl.class), mock(DashboardSummaryCache.class), mock(RealtimeNotifier.class), presence,
            mock(MatchmakingService.class));
    private final AtomicLong now = new AtomicLong(10_000);
    private final Map<Long, User> players = new HashMap<>();

    @BeforeEach
    void setUp() {
        arena.useClock(now::get);
        arena.useRandom(AnswerOrder.correctAt(2));
        for (long id = 1; id <= 2; id++) {
            User user = new User();
            user.setId(id);
            user.setUsername("player" + id);
            user.setElo(500);
            players.put(id, user);
            when(users.findById(id)).thenReturn(Optional.of(user));
        }
        when(questions.drawForElo(anyInt(), anyInt(), any())).thenReturn(BattleEngineTest.questions(10));
        when(avatars.findDtosByUserIds(anyCollection())).thenReturn(Map.of());
        when(presence.isConnected(any())).thenReturn(true);
        when(friendships.findFriendshipBetween(any(), any())).thenReturn(Optional.empty());
    }

    private void startGame() {
        var game = new GameSession();
        game.setId("game");
        game.setPlayer1Id(1L);
        game.setPlayer2Id(2L);
        game.setPlayer1Elo(players.get(1L).getElo());
        game.setPlayer2Elo(players.get(2L).getElo());
        arena.addGame(game);
    }

    private Friendship friendsRequestedBy(long requester) {
        var friendship = new Friendship(players.get(requester), players.get(3 - requester), FriendshipStatus.ACCEPTED);
        when(friendships.findFriendshipBetween(any(), any())).thenReturn(Optional.of(friendship));
        return friendship;
    }

    @Test
    void aWinOverAFriendCountsOnceForTheRequesterEvenIfTheGameIsFinishedAgain() {
        var friendship = friendsRequestedBy(1L);
        startGame();
        assertEquals(SurrenderResult.SURRENDERED, arena.surrenderGame("game", 2L));
        arena.finishGame("game", 2L);
        assertEquals(SurrenderResult.NOT_ACTIVE, arena.surrenderGame("game", 1L));
        assertEquals(1, friendship.getRequesterWins());
        assertEquals(0, friendship.getReceiverWins());
        verify(friendships, times(1)).save(friendship);
    }

    @Test
    void aWinOverAFriendCountsForTheReceiver() {
        var friendship = friendsRequestedBy(1L);
        startGame();
        arena.surrenderGame("game", 1L);
        assertEquals(0, friendship.getRequesterWins());
        assertEquals(1, friendship.getReceiverWins());
    }

    @Test
    void aWinOverAStrangerLeavesTheWinBalanceAlone() {
        startGame();
        arena.surrenderGame("game", 1L);
        verify(friendships, never()).save(any());
    }

    @Test
    void aDrawBetweenFriendsAfterTheLastRoundLeavesTheWinBalanceAlone() {
        var friendship = friendsRequestedBy(1L);
        startGame();
        for (int round = 1; round <= BattleEngine.ROUNDS; round++) {
            now.addAndGet(BattleEngine.ROUND_MILLIS);
            arena.tickBattles();
            now.addAndGet(BattleEngine.REVEAL_MILLIS);
            arena.tickBattles();
        }
        var finished = arena.getGameSession("game");
        assertEquals("FINISHED", finished.getStatus());
        assertEquals("ROUNDS", finished.getFinishReason());
        assertNull(finished.getWinnerId());
        assertEquals(0, friendship.getRequesterWins() + friendship.getReceiverWins());
        verify(friendships, never()).save(any());
    }

    @Test
    void theLosersEloNeverDropsBelowZero() {
        players.get(1L).setElo(10);
        players.get(2L).setElo(10);
        startGame();
        arena.surrenderGame("game", 1L);
        var finished = arena.getGameSession("game");
        assertEquals(0, players.get(1L).getElo());
        assertEquals(-10, finished.getPlayer1EloChange());
        assertEquals(26, players.get(2L).getElo());
        assertEquals(16, finished.getPlayer2EloChange());
    }

    @Test
    void eloChangesStopTheLoserAtZeroAtAnyRating() {
        for (int loser = 0; loser <= 40; loser++) {
            for (int winner : new int[] {0, loser, 400, 3000}) {
                int[] changes = ArenaServiceImpl.eloChanges(winner, loser);
                assertTrue(loser + changes[1] >= 0, "loser " + loser + " against " + winner);
                assertTrue(changes[0] >= 0, "winner " + winner + " against " + loser);
            }
        }
    }

    @Test
    void racingFinishesSettleEloAndTheFriendBalanceOnlyOnce() throws Exception {
        var friendship = friendsRequestedBy(1L);
        startGame();
        var pool = Executors.newFixedThreadPool(2);
        var ready = new CountDownLatch(2);
        var go = new CountDownLatch(1);
        var finishes = new ArrayList<Future<?>>();
        try {
            for (long winner = 1; winner <= 2; winner++) {
                long id = winner;
                finishes.add(pool.submit(() -> {
                    ready.countDown();
                    go.await();
                    arena.finishGame("game", id);
                    return null;
                }));
            }
            assertTrue(ready.await(5, TimeUnit.SECONDS));
            go.countDown();
            for (var finish : finishes) finish.get(5, TimeUnit.SECONDS);
        } finally {
            pool.shutdown();
            assertTrue(pool.awaitTermination(5, TimeUnit.SECONDS));
        }
        var finished = arena.getGameSession("game");
        verify(users, times(1)).saveAll(any());
        verify(friendships, times(1)).save(friendship);
        assertEquals(1, friendship.getRequesterWins() + friendship.getReceiverWins());
        assertEquals(1000, players.get(1L).getElo() + players.get(2L).getElo());
        assertEquals(16, finished.getWinnerId().equals(1L) ? finished.getPlayer1EloChange() : finished.getPlayer2EloChange());
    }
}
