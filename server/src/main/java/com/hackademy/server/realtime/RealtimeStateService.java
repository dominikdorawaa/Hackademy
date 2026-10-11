package com.hackademy.server.realtime;

import com.hackademy.server.arena.ArenaServiceImpl;
import com.hackademy.server.arena.MatchmakingService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

@Service
@RequiredArgsConstructor
public class RealtimeStateService {
    private final RealtimeFriendshipStateService friendships;
    private final ArenaServiceImpl arena;
    private final MatchmakingService matchmaking;
    private final String streamId = UUID.randomUUID().toString();
    private final AtomicLong revision = new AtomicLong();
    private final Object[] locks = java.util.stream.IntStream.range(0, 64).mapToObj(index -> new Object()).toArray();

    public RealtimeState forUser(Long userId) {
        synchronized (locks[Math.floorMod(userId.hashCode(), locks.length)]) {
            var game = arena.findCurrentGameForUser(userId);
            var social = friendships.forUser(userId);
            var challenges = arena.getPendingChallenges(social.userId());
            var outgoing = arena.getOutgoingChallenges(social.userId());
            boolean queued = matchmaking.isQueued(social.userId());
            return new RealtimeState(streamId, revision.incrementAndGet(), social.requests(), social.friends(), challenges, outgoing, game, queued);
        }
    }

}
