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

    private final com.github.benmanes.caffeine.cache.Cache<Long, RealtimeFriendshipStateService.State> socialCache =
            com.hackademy.server.cache.LocalCaches.weighted(10_000, java.time.Duration.ofSeconds(30), value -> 1 + value.friends().size() + value.requests().size());

    public void invalidateSocial(Long userId) { socialCache.invalidate(userId); }

    public RealtimeState forUser(Long userId) {
        synchronized (locks[Math.floorMod(userId.hashCode(), locks.length)]) {
            var game = arena.findCurrentGameForUser(userId);
            var social = socialCache.get(userId, friendships::forUser);
            var challenges = arena.getPendingChallenges(social.userId());
            var outgoing = arena.getOutgoingChallenges(social.userId());
            var expired = arena.getExpiredChallenges(social.userId());
            boolean queued = matchmaking.isQueued(social.userId());
            return new RealtimeState(streamId, revision.incrementAndGet(), social.requests(), social.friends(), challenges, outgoing,
                    expired, game, queued, System.currentTimeMillis());
        }
    }

}
