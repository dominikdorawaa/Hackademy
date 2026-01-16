package com.hackademy.server.service;

import com.hackademy.server.model.GameSession;

public interface MatchmakingService {
    void joinQueue(Long userId, String username);
    void leaveQueue(Long userId);
    GameSession checkForMatch();
}
