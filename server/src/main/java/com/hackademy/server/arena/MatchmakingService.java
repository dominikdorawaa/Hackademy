package com.hackademy.server.arena;

import java.util.List;

public interface MatchmakingService {
    void joinQueue(Long userId, String username);
    void leaveQueue(Long userId);
    List<GameSession> checkForMatches();
    default void releaseMatch(GameSession session) {}
    boolean isQueued(Long userId);
}
