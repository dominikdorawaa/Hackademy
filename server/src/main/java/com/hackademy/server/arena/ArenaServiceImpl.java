package com.hackademy.server.arena;

import com.hackademy.server.dashboard.DashboardSummaryCache;
import com.hackademy.server.friendship.FriendshipRepository;
import com.hackademy.server.realtime.RealtimeNotifier;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserAvatarRepository;
import com.hackademy.server.user.UserRepository;
import com.hackademy.server.user.UserServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.ContextClosedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.HashSet;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.LongSupplier;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ArenaServiceImpl implements ArenaService {

    static final long REACTION_GAP_MILLIS = 1_500;
    static final long REACTION_WINDOW_MILLIS = 10_000;
    static final int REACTION_WINDOW_LIMIT = 5;
    static final int REACTIONS_KEPT = 8;
    static final String SHUTTING_DOWN = "Arena jest chwilowo niedostępna. Spróbuj ponownie za chwilę.";
    static final String YOU_ARE_PLAYING = "Jesteś w trakcie pojedynku.";
    static final long CHALLENGER_GONE_MILLIS = 30_000;

    private final ArenaQuestionRepository questionRepository;
    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;
    private final UserAvatarRepository avatarRepository;
    private final UserServiceImpl userServiceImpl;
    private final DashboardSummaryCache dashboardSummaryCache;
    private final RealtimeNotifier realtime;
    private final ArenaPresence presence;

    private final Map<String, GameSession> activeGames = new ConcurrentHashMap<>();
    private final Map<String, Challenge> challenges = new ConcurrentHashMap<>();
    private final Map<Long, Deque<Long>> recentReactions = new ConcurrentHashMap<>();
    private final AtomicLong reactionIds = new AtomicLong();
    // A player can be in one game at a time. Queue matches and accepted challenges both reserve
    // their players here first, so whichever start comes first wins and the other one is refused.
    private final Set<Long> startingPlayers = new HashSet<>();
    private final Map<String, Long> challengerGoneSince = new ConcurrentHashMap<>();
    private LongSupplier clock = System::currentTimeMillis;
    private volatile boolean closing;

    void useClock(LongSupplier clock) {
        this.clock = clock;
    }

    @Override
    public void addGame(GameSession session) {
        if (closing) throw new IllegalStateException(SHUTTING_DOWN);
        reserve(session.getPlayer1Id(), busyMessage(session.getPlayer1Username()),
                session.getPlayer2Id(), busyMessage(session.getPlayer2Username()));
        try {
            prepareBattle(session);
            start(session);
        } finally {
            release(session.getPlayer1Id(), session.getPlayer2Id());
        }
    }

    private void reserve(Long first, String firstBusy, Long second, String secondBusy) {
        synchronized (startingPlayers) {
            if (isPlaying(first)) throw new IllegalStateException(firstBusy);
            if (isPlaying(second)) throw new IllegalStateException(secondBusy);
            startingPlayers.add(first);
            startingPlayers.add(second);
        }
    }

    private void release(Long first, Long second) {
        synchronized (startingPlayers) {
            startingPlayers.remove(first);
            startingPlayers.remove(second);
        }
    }

    boolean isPlaying(Long userId) {
        synchronized (startingPlayers) {
            return startingPlayers.contains(userId) || findActiveGameForUser(userId) != null;
        }
    }

    private static String busyMessage(String username) {
        return username + " jest już w pojedynku.";
    }

    private void start(GameSession session) {
        activeGames.put(session.getId(), session);
        dropChallengesOf(session.getPlayer1Id(), session.getPlayer2Id());
        realtime.changed(session.getPlayer1Id(), session.getPlayer2Id());
    }

    // Once a game starts, nobody may pull its players into a second one, so their other challenges go away.
    private void dropChallengesOf(Long first, Long second) {
        var involved = Set.of(first, second);
        var notify = new HashSet<Long>();
        challenges.values().forEach(challenge -> {
            if (!involved.contains(challenge.getChallengerId()) && !involved.contains(challenge.getTargetId())) return;
            if (challenges.remove(challenge.getId(), challenge)) {
                challenge.setStatus("CANCELLED");
                challengerGoneSince.remove(challenge.getId());
                notify.add(challenge.getChallengerId());
                notify.add(challenge.getTargetId());
            }
        });
        notify.removeAll(involved);
        if (!notify.isEmpty()) realtime.changed(notify.toArray(Long[]::new));
    }

    private void withdraw(Challenge challenge) {
        if (challenges.remove(challenge.getId(), challenge)) {
            challenge.setStatus("CANCELLED");
            challengerGoneSince.remove(challenge.getId());
            realtime.changed(challenge.getChallengerId(), challenge.getTargetId());
        }
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

    @EventListener(ContextClosedEvent.class)
    public void cancelActiveGames() {
        closing = true;
        for (GameSession session : activeGames.values()) {
            synchronized (session) {
                if ("ACTIVE".equals(session.getStatus())) finish(session, null, "CANCELLED");
            }
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
        userRepository.saveAll(List.of(winner, loser));
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
    public SurrenderResult surrenderGame(String gameId, Long userId) {
        GameSession session = activeGames.get(gameId);
        if (session == null || !session.includes(userId)) return SurrenderResult.NOT_PLAYER;
        synchronized (session) {
            if (!"ACTIVE".equals(session.getStatus())) return SurrenderResult.NOT_ACTIVE;
            finish(session, session.opponentOf(userId), "SURRENDER");
            return SurrenderResult.SURRENDERED;
        }
    }

    @Override
    public ReactionOutcome react(String gameId, Long userId, String reactionId) {
        GameSession session = activeGames.get(gameId);
        if (session == null || !session.includes(userId)) return ReactionOutcome.of(ReactionOutcome.Status.NOT_PLAYER);
        var reaction = QuickReaction.fromId(reactionId);
        if (reaction.isEmpty()) return ReactionOutcome.of(ReactionOutcome.Status.UNKNOWN_REACTION);
        var mutedUntil = userRepository.findById(userId).map(User::getMutedUntil).orElse(null);
        if (mutedUntil != null && mutedUntil.isAfter(LocalDateTime.now(ZoneOffset.UTC))) {
            return new ReactionOutcome(ReactionOutcome.Status.MUTED, mutedUntil, 0);
        }
        long now = clock.getAsLong();
        Deque<Long> sent = recentReactions.computeIfAbsent(userId, ignored -> new ArrayDeque<>());
        synchronized (sent) {
            while (!sent.isEmpty() && now - sent.peekFirst() >= REACTION_WINDOW_MILLIS) sent.pollFirst();
            long wait = sent.isEmpty() ? 0 : REACTION_GAP_MILLIS - (now - sent.peekLast());
            if (sent.size() >= REACTION_WINDOW_LIMIT) wait = Math.max(wait, REACTION_WINDOW_MILLIS - (now - sent.peekFirst()));
            if (wait > 0) return new ReactionOutcome(ReactionOutcome.Status.TOO_FAST, null, wait);
            sent.addLast(now);
        }
        synchronized (session) {
            var reactions = session.getReactions();
            reactions.add(new ArenaReaction(reactionIds.incrementAndGet(), userId, reaction.get().id(), now));
            while (reactions.size() > REACTIONS_KEPT) reactions.remove(0);
        }
        realtime.changed(session.getPlayer1Id(), session.getPlayer2Id());
        return ReactionOutcome.of(ReactionOutcome.Status.SENT);
    }

    @Override
    public Challenge createChallenge(Long challengerId, String challengerUsername, Long targetId, String targetUsername) {
        if (challengerId.equals(targetId)) throw new IllegalArgumentException("Nie możesz wyzwać samego siebie.");
        if (isPlaying(challengerId)) throw new IllegalStateException(YOU_ARE_PLAYING);
        if (isPlaying(targetId)) throw new IllegalStateException(busyMessage(targetUsername));
        boolean alreadySent = challenges.values().stream().anyMatch(existing -> "PENDING".equals(existing.getStatus())
                && existing.getChallengerId().equals(challengerId) && existing.getTargetId().equals(targetId));
        if (alreadySent) throw new IllegalStateException("Już wyzwałeś " + targetUsername + ".");
        Challenge challenge = new Challenge(UUID.randomUUID().toString(), challengerId, challengerUsername,
                targetId, targetUsername, LocalDateTime.now(), "PENDING");
        var avatars = avatarRepository.findDtosByUserIds(List.of(challengerId, targetId));
        challenge.setChallengerAvatar(avatars.get(challengerId));
        challenge.setTargetAvatar(avatars.get(targetId));
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
            if (closing) throw new IllegalStateException(SHUTTING_DOWN);
            try {
                reserve(userId, YOU_ARE_PLAYING, challenge.getChallengerId(), busyMessage(challenge.getChallengerUsername()));
            } catch (IllegalStateException busy) {
                // Whoever is already playing, this challenge can never be played now.
                withdraw(challenge);
                throw busy;
            }
            try {
                return startChallenge(challenge);
            } finally {
                release(userId, challenge.getChallengerId());
            }
        }
    }

    private GameSession startChallenge(Challenge challenge) {
        User challenger = userRepository.findById(challenge.getChallengerId()).orElse(null);
        User target = userRepository.findById(challenge.getTargetId()).orElse(null);
        if (challenger == null || target == null) {
            throw new IllegalStateException("Users not found");
        }
        GameSession session = new GameSession();
        session.setId(UUID.randomUUID().toString());
        session.setPlayer1Id(challenger.getId());
        session.setPlayer1Username(challenge.getChallengerUsername());
        session.setPlayer1Elo(challenger.getElo());
        session.setPlayer2Id(target.getId());
        session.setPlayer2Username(challenge.getTargetUsername());
        session.setPlayer2Elo(target.getElo());
        prepareBattle(session);
        challenge.setStatus("ACCEPTED");
        challenges.remove(challenge.getId());
        challengerGoneSince.remove(challenge.getId());
        start(session);
        return session.snapshot();
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
            challengerGoneSince.remove(challengeId);
            realtime.changed(challenge.getChallengerId(), challenge.getTargetId());
        }
    }

    // A challenge from someone who closed Hackademy would wait forever; drop it once they are gone for a while.
    @Scheduled(fixedRate = 5_000)
    public void sweepAbandonedChallenges() {
        long now = clock.getAsLong();
        for (Challenge challenge : challenges.values()) {
            if (presence.isConnected(challenge.getChallengerId())) {
                challengerGoneSince.remove(challenge.getId());
                continue;
            }
            long since = challengerGoneSince.computeIfAbsent(challenge.getId(), ignored -> now);
            if (now - since < CHALLENGER_GONE_MILLIS) continue;
            synchronized (challenge) {
                if ("PENDING".equals(challenge.getStatus())) withdraw(challenge);
            }
        }
    }
}
