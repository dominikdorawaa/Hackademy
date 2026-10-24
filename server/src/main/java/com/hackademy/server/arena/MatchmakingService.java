package com.hackademy.server.arena;

import java.util.List;
import java.util.Map;

public interface MatchmakingService {
    void joinQueue(Long userId, String username);
    void leaveQueue(Long userId);
    boolean takeFromQueue(Map<Long, Long> players);
    List<GameSession> checkForMatches();
    default void releaseMatch(GameSession session) {}
    boolean isQueued(Long userId);
}
