package com.hackademy.server.realtime;

import com.hackademy.server.arena.ArenaServiceImpl;
import com.hackademy.server.arena.GameSession;
import com.hackademy.server.arena.MatchmakingService;
import com.hackademy.server.friendship.FriendshipRepository;
import com.hackademy.server.friendship.FriendshipStatus;
import com.hackademy.server.friendship.FriendDto;
import com.hackademy.server.friendship.FriendRequestDto;
import com.hackademy.server.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RealtimeStateService {
    private final UserRepository users;
    private final FriendshipRepository friendships;
    private final ArenaServiceImpl arena;
    private final MatchmakingService matchmaking;
    private final String streamId = UUID.randomUUID().toString();
    private final AtomicLong revision = new AtomicLong();
    private final Object[] locks = java.util.stream.IntStream.range(0, 64).mapToObj(index -> new Object()).toArray();

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public RealtimeState forUser(String username) {
        synchronized (locks[Math.floorMod(username.hashCode(), locks.length)]) {
            var user = users.findByUsername(username).orElseThrow();
            var requests = friendships.findPendingRequestsForUser(user).stream()
                    .map(friendship -> new FriendRequestDto(friendship.getId(), friendship.getRequester().getUsername(),
                            friendship.getCreatedAt(), friendship.getRequester().getAvatarSeed())).toList();
            var friends = friendships.findByUserAndStatus(user, FriendshipStatus.ACCEPTED).stream()
                    .map(friendship -> friendship.getRequester().getId().equals(user.getId())
                            ? friendship.getReceiver() : friendship.getRequester())
                    .map(friend -> new FriendDto(friend.getId(), friend.getUsername(), friend.getPoints(),
                            friend.getStreak(), friend.getAvatarSeed())).toList();
            var challenges = arena.getPendingChallenges(user.getId());
            var outgoing = arena.getOutgoingChallenges(user.getId());
            var game = copyGame(arena.findCurrentGameForUser(user.getId()));
            boolean queued = matchmaking.isQueued(user.getId());
            return new RealtimeState(streamId, revision.incrementAndGet(), requests, friends, challenges, outgoing, game, queued);
        }
    }

    private GameSession copyGame(GameSession game) {
        if (game == null) return null;
        return new GameSession(game.getId(), game.getPlayer1Id(), game.getPlayer1Username(), game.getPlayer1AvatarSeed(),
                game.getPlayer1Elo(), game.getPlayer2Id(), game.getPlayer2Username(), game.getPlayer2AvatarSeed(),
                game.getPlayer2Elo(), game.getRoomId(), game.getStartTime(), game.getStatus(), game.getWinnerId(),
                game.getPlayer1EloChange(), game.getPlayer2EloChange(),
                game.getHintsUsed().entrySet().stream().collect(Collectors.toMap(java.util.Map.Entry::getKey,
                        entry -> List.copyOf(entry.getValue()))),
                new HashMap<>(game.getFinishTimes()), new HashMap<>(game.getPenaltiesInSeconds()));
    }
}
