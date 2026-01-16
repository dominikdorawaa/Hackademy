package com.hackademy.server.service;

import com.hackademy.server.model.Challenge;
import com.hackademy.server.model.GameSession;

import java.util.List;

public interface ArenaService {
    GameSession getGameSession(String gameId);
    void addGame(GameSession session);
    void finishGame(String gameId, Long winnerId);
    GameSession findActiveGameForUser(Long userId);
    GameSession findCurrentGameForUser(Long userId);
    boolean submitFlag(String gameId, Long userId, String flag);
    void useHint(String gameId, Long userId, Long hintId); // Updated method
    void surrenderGame(String gameId, Long userId); // New method
    
    // Challenge methods
    Challenge createChallenge(Long challengerId, String challengerUsername, Long targetId, String targetUsername);
    GameSession acceptChallenge(String challengeId, Long userId);
    void rejectChallenge(String challengeId, Long userId);
    List<Challenge> getPendingChallenges(Long userId);
}
