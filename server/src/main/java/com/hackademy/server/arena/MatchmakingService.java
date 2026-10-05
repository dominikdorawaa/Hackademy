package com.hackademy.server.arena;

import java.util.List;

public interface MatchmakingService {
    void joinQueue(Long userId, String username, boolean vpnEnabled);
    void leaveQueue(Long userId);
    List<GameSession> checkForMatches();
}
