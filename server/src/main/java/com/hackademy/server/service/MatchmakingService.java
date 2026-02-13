package com.hackademy.server.service;

import com.hackademy.server.model.GameSession;
import java.util.List;

public interface MatchmakingService {
    void joinQueue(Long userId, String username, boolean vpnEnabled);
    void leaveQueue(Long userId);
    List<GameSession> checkForMatches();
}
