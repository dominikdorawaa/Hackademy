package com.hackademy.server.arena;

import com.hackademy.server.chat.ChatService;
import com.hackademy.server.dashboard.DashboardSummaryCache;
import com.hackademy.server.friendship.FriendshipRepository;
import com.hackademy.server.realtime.RealtimeNotifier;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserAvatarRepository;
import com.hackademy.server.user.UserRepository;
import com.hackademy.server.user.UserServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ArenaServiceImpl implements ArenaService {

    private final ArenaQuestionRepository questionRepository;
    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;
    private final UserAvatarRepository avatarRepository;
    private final ChatService chatService;
    private final UserServiceImpl userServiceImpl;
    private final DashboardSummaryCache dashboardSummaryCache;
    private final RealtimeNotifier realtime;
    private final ArenaPresence presence;

    private final Map<String, GameSession> activeGames = new ConcurrentHashMap<>();
    private final Map<String, Challenge> challenges = new ConcurrentHashMap<>();
    private LongSupplier clock = System::currentTimeMillis;

    void useClock(LongSupplier clock) {
        this.clock = clock;
    }

    @Override
    public void addGame(GameSession session) {
        prepareBattle(session);
        activeGames.put(session.getId(), session);
        realtime.changed(session.getPlayer1Id(), session.getPlayer2Id());
    }

    private void prepareBattle(GameSession session) {
        var avatars = avatarRepository.findDtosByUserIds(List.of(session.getPlayer1Id(), session.getPlayer2Id()));
        session.setPlayer1Avatar(avatars.get(session.getPlayer1Id()));
        session.setPlayer2Avatar(avatars.get(session.getPlayer2Id()));
        session.setStartTime(LocalDateTime.now());
        BattleEngine.start(session, questionRepository.findRandom(BattleEngine.ROUNDS), clock.getAsLong());
    }

    @Override
    public GameSession getGameSession(String gameId) {
        GameSession session = activeGames.get(gameId);
        return session == null ? null : session.snapshot();
    }

    @Override
    public BattleEngine.AnswerResult answer(String gameId, Long userId, int round, int answer) {
        GameSession session = activeGames.get(gameId);
        if (session == null) return BattleEngine.AnswerResult.NOT_PLAYER;
        synchronized (session) {
            long now = clock.getAsLong();
            var result = BattleEngine.answer(session, userId, round, answer, now);
            if (result != BattleEngine.AnswerResult.ACCEPTED) return result;
            if (BattleEngine.roundOver(session, now)) resolveRound(session, now);
            realtime.changed(session.getPlayer1Id(), session.getPlayer2Id());
            return result;
        }
    }

    @Scheduled(fixedRate = 250)
    public void tickBattles() {
        long now = clock.getAsLong();
        for (GameSession session : activeGames.values()) {
            synchronized (session) {
                if (!"ACTIVE".equals(session.getStatus())) continue;
                boolean changed = checkConnections(session, now);
                if ("ACTIVE".equals(session.getStatus()) && BattleEngine.roundOver(session, now)) {
                    resolveRound(session, now);
                    changed = true;
                } else if (BattleEngine.nextRoundDue(session, now)) {
                    BattleEngine.nextRound(session, now);
                    changed = true;
                }
                if (changed) realtime.changed(session.getPlayer1Id(), session.getPlayer2Id());
            }
        }
    }

    private boolean checkConnections(GameSession session, long now) {
        for (Long player : List.of(session.getPlayer1Id(), session.getPlayer2Id())) {
            if (presence.isConnected(player)) {
                session.getDisconnectedSince().remove(player);
                continue;
            }
            long since = session.getDisconnectedSince().computeIfAbsent(player, ignored -> now);
            if (now - since >= BattleEngine.DISCONNECT_MILLIS) {
                finish(session, session.opponentOf(player), "DISCONNECT");
                return true;
            }
        }
        return false;
    }

    private void resolveRound(GameSession session, long now) {
        if (BattleEngine.resolve(session, now)) {
            finish(session, BattleEngine.leader(session), BattleEngine.finishReason(session));
        }
    }

    @Override
    public void finishGame(String gameId, Long winnerId) {
        GameSession session = activeGames.get(gameId);
        if (session == null) return;
        synchronized (session) {
            finish(session, winnerId, "SURRENDER");
        }
    }

    private void finish(GameSession session, Long winnerId, String reason) {
        if ("FINISHED".equals(session.getStatus())) return;
        session.setStatus("FINISHED");
        session.setWinnerId(winnerId);
        session.setFinishReason(reason);
        session.setPlayer1EloChange(0);
        session.setPlayer2EloChange(0);
        if (winnerId != null) recordWin(session, winnerId);
        chatService.cleanupChat(session.getId());
        realtime.changed(session.getPlayer1Id(), session.getPlayer2Id());
    }

    private void recordWin(GameSession session, Long winnerId) {
        Long loserId = session.opponentOf(winnerId);
        Optional<User> winnerOpt = userRepository.findById(winnerId);
        Optional<User> loserOpt = userRepository.findById(loserId);
        if (winnerOpt.isEmpty() || loserOpt.isEmpty()) return;
        User winner = winnerOpt.get();
        User loser = loserOpt.get();
        updateElo(winner, loser, session);
        userRepository.save(winner);
        userRepository.save(loser);
        userServiceImpl.invalidateUserComputedCaches(winnerId);
        userServiceImpl.invalidateUserComputedCaches(loserId);
        userServiceImpl.invalidateGlobalRankingCache();
        dashboardSummaryCache.invalidateUser(winnerId);
        dashboardSummaryCache.invalidateUser(loserId);
        friendshipRepository.findFriendshipBetween(winner, loser).ifPresent(friendship -> {
            if (friendship.getRequester().getId().equals(winnerId)) {
                friendship.setRequesterWins(friendship.getRequesterWins() + 1);
            } else {
                friendship.setReceiverWins(friendship.getReceiverWins() + 1);
            }
            friendshipRepository.save(friendship);
        });
    }

    private void updateElo(User winner, User loser, GameSession session) {
        int k = 32;
        double winnerExpected = 1.0 / (1.0 + Math.pow(10.0, (loser.getElo() - winner.getElo()) / 400.0));
        double loserExpected = 1.0 / (1.0 + Math.pow(10.0, (winner.getElo() - loser.getElo()) / 400.0));
        int winnerNewElo = (int) Math.round(winner.getElo() + k * (1.0 - winnerExpected));
        int loserNewElo = Math.max(0, (int) Math.round(loser.getElo() + k * (0.0 - loserExpected)));
        int winnerChange = winnerNewElo - winner.getElo();
        int loserChange = loserNewElo - loser.getElo();
        winner.setElo(winnerNewElo);
        loser.setElo(loserNewElo);
        if (session.getPlayer1Id().equals(winner.getId())) {
            session.setPlayer1EloChange(winnerChange);
            session.setPlayer2EloChange(loserChange);
        } else {
            session.setPlayer2EloChange(winnerChange);
            session.setPlayer1EloChange(loserChange);
        }
    }

    @Override
    public GameSession findActiveGameForUser(Long userId) {
        return activeGames.values().stream()
                .filter(game -> game.includes(userId))
                .map(GameSession::snapshot)
                .filter(game -> "ACTIVE".equals(game.getStatus()))
                .findFirst()
                .orElse(null);
    }

    @Override
    public GameSession findCurrentGameForUser(Long userId) {
        return activeGames.values().stream()
                .filter(game -> game.includes(userId))
                .map(GameSession::snapshot)
                .sorted((first, second) -> {
                    boolean firstActive = "ACTIVE".equals(first.getStatus());
                    boolean secondActive = "ACTIVE".equals(second.getStatus());
                    if (firstActive != secondActive) return firstActive ? -1 : 1;
                    return second.getStartTime().compareTo(first.getStartTime());
                })
                .findFirst()
                .orElse(null);
    }

    @Override
    public void surrenderGame(String gameId, Long userId) {
        GameSession session = activeGames.get(gameId);
        if (session == null) return;
        synchronized (session) {
            if ("ACTIVE".equals(session.getStatus()) && session.includes(userId)) {
                finish(session, session.opponentOf(userId), "SURRENDER");
            }
        }
    }

    @Override
    public Challenge createChallenge(Long challengerId, String challengerUsername, Long targetId, String targetUsername) {
        Challenge challenge = new Challenge(UUID.randomUUID().toString(), challengerId, challengerUsername,
                targetId, targetUsername, LocalDateTime.now(), "PENDING");
        challenge.setChallengerAvatarSeed(userRepository.findById(challengerId).map(User::getAvatarSeed).orElse(challengerUsername));
        challenge.setTargetAvatarSeed(userRepository.findById(targetId).map(User::getAvatarSeed).orElse(targetUsername));
        challenges.put(challenge.getId(), challenge);
        realtime.changed(challengerId, targetId);
        return challenge;
    }

    @Override
    public GameSession acceptChallenge(String challengeId, Long userId) {
        Challenge challenge = challenges.get(challengeId);
        if (challenge == null) throw new IllegalArgumentException("Invalid challenge");
        synchronized (challenge) {
            if (challenges.get(challengeId) != challenge || !challenge.getTargetId().equals(userId) || !"PENDING".equals(challenge.getStatus())) {
                throw new IllegalArgumentException("Invalid challenge");
            }
            User challenger = userRepository.findById(challenge.getChallengerId()).orElse(null);
            User target = userRepository.findById(challenge.getTargetId()).orElse(null);
            if (challenger == null || target == null) {
                throw new IllegalStateException("Users not found");
            }
            GameSession session = new GameSession();
            session.setId(UUID.randomUUID().toString());
            session.setPlayer1Id(challenger.getId());
            session.setPlayer1Username(challenge.getChallengerUsername());
            session.setPlayer1AvatarSeed(challenger.getAvatarSeed());
            session.setPlayer1Elo(challenger.getElo());
            session.setPlayer2Id(target.getId());
            session.setPlayer2Username(challenge.getTargetUsername());
            session.setPlayer2AvatarSeed(target.getAvatarSeed());
            session.setPlayer2Elo(target.getElo());
            prepareBattle(session);
            activeGames.put(session.getId(), session);
            challenge.setStatus("ACCEPTED");
            challenges.remove(challengeId);
            realtime.changed(session.getPlayer1Id(), session.getPlayer2Id());
            return session.snapshot();
        }
    }

    @Override
    public void rejectChallenge(String challengeId, Long userId) {
        Challenge challenge = challenges.get(challengeId);
        if (challenge == null) return;
        synchronized (challenge) {
            if (challenges.get(challengeId) == challenge && "PENDING".equals(challenge.getStatus()) && challenge.getTargetId().equals(userId)) {
                challenge.setStatus("REJECTED");
                challenges.remove(challengeId);
                realtime.changed(challenge.getChallengerId(), challenge.getTargetId());
            }
        }
    }

    @Override
    public List<Challenge> getPendingChallenges(Long userId) {
        return challenges.values().stream()
                .filter(challenge -> challenge.getTargetId().equals(userId) && "PENDING".equals(challenge.getStatus()))
                .collect(Collectors.toList());
    }

    public List<Challenge> getOutgoingChallenges(Long userId) {
        return challenges.values().stream()
                .filter(challenge -> challenge.getChallengerId().equals(userId) && "PENDING".equals(challenge.getStatus()))
                .toList();
    }

    @Override
    public void cancelChallenge(String challengeId, Long userId) {
        var challenge = challenges.get(challengeId);
        if (challenge == null) throw new IllegalArgumentException("Invalid challenge");
        synchronized (challenge) {
            if (challenges.get(challengeId) != challenge || !"PENDING".equals(challenge.getStatus()) || !challenge.getChallengerId().equals(userId)) {
                throw new IllegalArgumentException("Invalid challenge");
            }
            challenges.remove(challengeId);
            realtime.changed(challenge.getChallengerId(), challenge.getTargetId());
        }
    }
}
