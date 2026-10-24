package com.hackademy.server.arena;

import java.util.List;

public interface ArenaService {
    void cancelChallenge(String challengeId, Long userId);
    GameSession getGameSession(String gameId);
    boolean addGame(GameSession session);
    void joinQueue(Long userId, String username);
    void finishGame(String gameId, Long winnerId);
    GameSession findActiveGameForUser(Long userId);
    GameSession findCurrentGameForUser(Long userId);
    BattleEngine.AnswerResult answer(String gameId, Long userId, int round, int answer);
    SurrenderResult surrenderGame(String gameId, Long userId);
    ReactionOutcome react(String gameId, Long userId, String reaction);
    boolean leaveView(String gameId, Long userId);
    boolean returnToView(String gameId, Long userId);

    Challenge createChallenge(Long challengerId, String challengerUsername, Long targetId, String targetUsername);
    GameSession acceptChallenge(String challengeId, Long userId);
    void rejectChallenge(String challengeId, Long userId);
    List<Challenge> getPendingChallenges(Long userId);
    void dismissExpiredChallenge(String challengeId, Long userId);
}
