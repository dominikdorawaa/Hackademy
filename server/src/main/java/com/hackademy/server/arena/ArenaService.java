package com.hackademy.server.arena;

import java.util.List;

public interface ArenaService {
    void cancelChallenge(String challengeId, Long userId);
    GameSession getGameSession(String gameId);
    void addGame(GameSession session);
    void finishGame(String gameId, Long winnerId);
    GameSession findActiveGameForUser(Long userId);
    GameSession findCurrentGameForUser(Long userId);
    BattleEngine.AnswerResult answer(String gameId, Long userId, int round, int answer);
    void surrenderGame(String gameId, Long userId);

    Challenge createChallenge(Long challengerId, String challengerUsername, Long targetId, String targetUsername);
    GameSession acceptChallenge(String challengeId, Long userId);
    void rejectChallenge(String challengeId, Long userId);
    List<Challenge> getPendingChallenges(Long userId);
}
