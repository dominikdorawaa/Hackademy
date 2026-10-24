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

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.LongSupplier;
import java.util.random.RandomGenerator;
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
    static final String STALE_CHALLENGE = "To wyzwanie jest już nieaktualne.";
    static final long PLAYER_GONE_MILLIS = 30_000;

    private final ArenaQuestionRepository questionRepository;
    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;
    private final UserAvatarRepository avatarRepository;
    private final UserServiceImpl userServiceImpl;
    private final DashboardSummaryCache dashboardSummaryCache;
    private final RealtimeNotifier realtime;
    private final ArenaPresence presence;
    private final MatchmakingService matchmaking;

    private final Map<String, GameSession> activeGames = new ConcurrentHashMap<>();
    private final Map<Long, String> currentGames = new ConcurrentHashMap<>();
    private final Map<String, Long> finishedAt = new ConcurrentHashMap<>();
    private final Map<String, Long> challengeCreatedAt = new ConcurrentHashMap<>();
    private final Map<String, Challenge> challenges = new ConcurrentHashMap<>();
    private final Map<Long, Deque<Long>> recentReactions = new ConcurrentHashMap<>();
    private final AtomicLong reactionIds = new AtomicLong();
    // A player can be in one game at a time. Queue matches and accepted challenges both reserve their
    // players under this lock first, so whichever start comes first wins and the other one is refused.
    private final Object players = new Object();
    private final Set<Long> startingPlayers = new HashSet<>();
    private final Map<Long, String> playingIn = new HashMap<>();
    private final Map<Long, Long> playerGoneSince = new ConcurrentHashMap<>();
    private LongSupplier clock = System::currentTimeMillis;
    private RandomGenerator random = new SecureRandom();
    private volatile boolean closing;

    void useClock(LongSupplier clock) {
        this.clock = clock;
    }

    void useRandom(RandomGenerator random) {
        this.random = random;
    }

    @Override
    public boolean addGame(GameSession session) {
        if (closing) throw new IllegalStateException(SHUTTING_DOWN);
        try {
            reserve(session.getPlayer1Id(), busyMessage(session.getPlayer1Username()),
                    session.getPlayer2Id(), busyMessage(session.getPlayer2Username()));
        } catch (PlayerBusyException busy) {
            // Someone already in a duel has no business in the queue; dropping them frees their partner.
            if (hasGame(busy.userId)) matchmaking.leaveQueue(busy.userId);
            throw busy;
        }
        try {
            prepareBattle(session);
            return start(session);
        } finally {
            release(session.getPlayer1Id(), session.getPlayer2Id());
        }
    }

    @Override
    public void joinQueue(Long userId, String username) {
        synchronized (players) {
            if (isPlaying(userId)) throw new IllegalStateException(YOU_ARE_PLAYING);
            matchmaking.joinQueue(userId, username);
        }
    }

    static final class PlayerBusyException extends IllegalStateException {
        private final Long userId;

        PlayerBusyException(Long userId, String message) {
            super(message);
            this.userId = userId;
        }
    }

    private void reserve(Long first, String firstBusy, Long second, String secondBusy) {
        synchronized (players) {
            if (isPlaying(first)) throw new PlayerBusyException(first, firstBusy);
            if (isPlaying(second)) throw new PlayerBusyException(second, secondBusy);
            startingPlayers.add(first);
            startingPlayers.add(second);
        }
    }

    private void release(Long first, Long second) {
        synchronized (players) {
            startingPlayers.remove(first);
            startingPlayers.remove(second);
        }
    }

    private boolean isPlaying(Long userId) {
        synchronized (players) {
            return startingPlayers.contains(userId) || playingIn.containsKey(userId);
        }
    }

    private boolean hasGame(Long userId) {
        synchronized (players) {
            return playingIn.containsKey(userId);
        }
    }

    private static String busyMessage(String username) {
        return username + " jest już w pojedynku.";
    }

    // A starting game takes its players out of the queue and drops their other challenges, all at once,
    // so nothing created a moment earlier can pull them into a second game.
    private boolean start(GameSession session) {
        List<Challenge> dropped;
        synchronized (players) {
            if (!session.getQueueTickets().isEmpty() && !matchmaking.takeFromQueue(session.getQueueTickets())) return false;
            activeGames.put(session.getId(), session);
            for (Long person : session.people()) {
                currentGames.put(person, session.getId());
                playingIn.put(person, session.getId());
            }
            dropped = challenges.values().stream().filter(challenge -> session.includes(challenge.getChallengerId())
                    || session.includes(challenge.getTargetId())).toList();
            dropped.forEach(challenge -> removeChallenge(challenge, "CANCELLED"));
        }
        for (Long person : session.people()) matchmaking.leaveQueue(person);
        realtime.arenaChanged(session.people());
        var others = new TreeSet<Long>();
        dropped.forEach(challenge -> {
            others.add(challenge.getChallengerId());
            others.add(challenge.getTargetId());
        });
        others.remove(session.getPlayer1Id());
        others.remove(session.getPlayer2Id());
        if (!others.isEmpty()) realtime.arenaChanged(others.toArray(Long[]::new));
        return true;
    }

    private boolean removeChallenge(Challenge challenge, String status) {
        if (!challenges.remove(challenge.getId(), challenge)) return false;
        challengeCreatedAt.remove(challenge.getId());
        challenge.setStatus(status);
        return true;
    }

    private void prepareBattle(GameSession session) {
        var avatars = avatarRepository.findDtosByUserIds(List.of(session.people()));
        if (!session.isBot(session.getPlayer1Id())) session.setPlayer1Avatar(avatars.get(session.getPlayer1Id()));
        if (!session.isBot(session.getPlayer2Id())) session.setPlayer2Avatar(avatars.get(session.getPlayer2Id()));
        session.setStartTime(LocalDateTime.now());
        int elo = QuestionDraw.averageElo(session.getPlayer1Elo(), session.getPlayer2Elo());
        BattleEngine.start(session, questionRepository.drawForElo(elo, BattleEngine.ROUNDS, random), clock.getAsLong(), random);
        BotPlayer.plan(session, random);
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
            if (!"FINISHED".equals(session.getStatus())) realtime.arenaChanged(session.people());
            return result;
        }
    }

    @Scheduled(fixedRate = 250)
    public void tickBattles() {
        long now = clock.getAsLong();
        for (GameSession session : activeGames.values()) {
            synchronized (session) {
                if (!"ACTIVE".equals(session.getStatus())) continue;
                boolean changed = BotPlayer.act(session, now);
                if (BattleEngine.roundOver(session, now)) {
                    resolveRound(session, now);
                    changed = true;
                } else if (BattleEngine.nextRoundDue(session, now)) {
                    BattleEngine.nextRound(session, now);
                    BotPlayer.plan(session, random);
                    changed = true;
                }
                if ("ACTIVE".equals(session.getStatus())) changed |= checkPresence(session, now);
                if (changed && !"FINISHED".equals(session.getStatus())) realtime.arenaChanged(session.people());
            }
        }
    }

    private boolean checkPresence(GameSession session, long now) {
        var absent = new HashMap<Long, ArenaAbsence.Reason>();
        for (Long player : session.people()) {
            if (!presence.isConnected(player)) absent.put(player, ArenaAbsence.Reason.DISCONNECTED);
            else if (session.getLeftView().contains(player)) absent.put(player, ArenaAbsence.Reason.LEFT);
        }
        var verdict = BattlePresence.update(session, absent, now);
        if (verdict.finished()) finish(session, verdict.winnerId(), verdict.reason());
        return verdict.changed();
    }

    @Override
    public boolean leaveView(String gameId, Long userId) {
        return markView(gameId, userId, true);
    }

    @Override
    public boolean returnToView(String gameId, Long userId) {
        return markView(gameId, userId, false);
    }

    private boolean markView(String gameId, Long userId, boolean left) {
        GameSession session = activeGames.get(gameId);
        if (session == null || !session.includes(userId)) return false;
        synchronized (session) {
            if (left) session.getLeftView().add(userId);
            else session.getLeftView().remove(userId);
        }
        return true;
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
        session.setPause(null);
        finishedAt.put(session.getId(), clock.getAsLong());
        synchronized (players) {
            for (Long person : session.people()) playingIn.remove(person, session.getId());
        }
        session.setWinnerId(winnerId);
        session.setFinishReason(reason);
        session.setPlayer1EloChange(0);
        session.setPlayer2EloChange(0);
        if (winnerId != null && session.getBotId() != null) recordBotGame(session, winnerId);
        else if (winnerId != null) recordWin(session, winnerId);
        realtime.changed(session.people());
    }

    private void recordBotGame(GameSession session, Long winnerId) {
        Long humanId = session.opponentOf(session.getBotId());
        User human = userRepository.findById(humanId).orElse(null);
        if (human == null) return;
        int botElo = session.eloOf(session.getBotId());
        int[] changes = humanId.equals(winnerId) ? eloChanges(human.getElo(), botElo) : eloChanges(botElo, human.getElo());
        human.setElo(human.getElo() + (humanId.equals(winnerId) ? changes[0] : changes[1]));
        setEloChanges(session, winnerId, changes);
        userRepository.save(human);
        userServiceImpl.invalidateUserComputedCaches(humanId);
        userServiceImpl.invalidateGlobalRankingCache();
        dashboardSummaryCache.invalidateUser(humanId);
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
        int[] changes = eloChanges(winner.getElo(), loser.getElo());
        winner.setElo(winner.getElo() + changes[0]);
        loser.setElo(loser.getElo() + changes[1]);
        setEloChanges(session, winner.getId(), changes);
    }

    static int[] eloChanges(int winnerElo, int loserElo) {
        int k = 32;
        double winnerExpected = 1.0 / (1.0 + Math.pow(10.0, (loserElo - winnerElo) / 400.0));
        double loserExpected = 1.0 / (1.0 + Math.pow(10.0, (winnerElo - loserElo) / 400.0));
        int winnerNewElo = (int) Math.round(winnerElo + k * (1.0 - winnerExpected));
        int loserNewElo = Math.max(0, (int) Math.round(loserElo + k * (0.0 - loserExpected)));
        return new int[] {winnerNewElo - winnerElo, loserNewElo - loserElo};
    }

    private static void setEloChanges(GameSession session, Long winnerId, int[] changes) {
        boolean firstWon = session.getPlayer1Id().equals(winnerId);
        session.setPlayer1EloChange(firstWon ? changes[0] : changes[1]);
        session.setPlayer2EloChange(firstWon ? changes[1] : changes[0]);
    }

    @Override
    public GameSession findActiveGameForUser(Long userId) {
        String id;
        synchronized (players) { id = playingIn.get(userId); }
        return id == null ? null : getGameSession(id);
    }

    @Override
    public GameSession findCurrentGameForUser(Long userId) {
        String id = currentGames.get(userId);
        return id == null ? null : getGameSession(id);
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
        realtime.arenaChanged(session.people());
        return ReactionOutcome.of(ReactionOutcome.Status.SENT);
    }

    @Override
    public Challenge createChallenge(Long challengerId, String challengerUsername, Long targetId, String targetUsername) {
        if (challengerId.equals(targetId)) throw new IllegalArgumentException("Nie możesz wyzwać samego siebie.");
        Challenge challenge = new Challenge(UUID.randomUUID().toString(), challengerId, challengerUsername,
                targetId, targetUsername, LocalDateTime.now(), "PENDING");
        var avatars = avatarRepository.findDtosByUserIds(List.of(challengerId, targetId));
        challenge.setChallengerAvatar(avatars.get(challengerId));
        challenge.setTargetAvatar(avatars.get(targetId));
        // Checked and stored under the players lock, so a game starting meanwhile either sees it or blocks it.
        synchronized (players) {
            if (isPlaying(challengerId)) throw new IllegalStateException(YOU_ARE_PLAYING);
            if (isPlaying(targetId)) throw new IllegalStateException(busyMessage(targetUsername));
            boolean alreadySent = challenges.values().stream().anyMatch(existing -> existing.getChallengerId().equals(challengerId)
                    && existing.getTargetId().equals(targetId));
            if (alreadySent) throw new IllegalStateException("Już wyzwałeś " + targetUsername + ".");
            if (challenges.size() >= 1024) throw new IllegalStateException(SHUTTING_DOWN);
            challenges.put(challenge.getId(), challenge);
            challengeCreatedAt.put(challenge.getId(), clock.getAsLong());
        }
        realtime.arenaChanged(challengerId, targetId);
        return challenge;
    }

    @Override
    public GameSession acceptChallenge(String challengeId, Long userId) {
        Challenge challenge = challenges.get(challengeId);
        if (challenge == null) throw new IllegalArgumentException(STALE_CHALLENGE);
        synchronized (challenge) {
            if (challenges.get(challengeId) != challenge || !challenge.getTargetId().equals(userId) || !"PENDING".equals(challenge.getStatus())) {
                throw new IllegalArgumentException(STALE_CHALLENGE);
            }
            if (closing) throw new IllegalStateException(SHUTTING_DOWN);
            try {
                reserve(userId, YOU_ARE_PLAYING, challenge.getChallengerId(), busyMessage(challenge.getChallengerUsername()));
            } catch (PlayerBusyException busy) {
                // A player merely starting another game may still fail to start it; only a running game ends this challenge.
                if (hasGame(busy.userId) && removeChallenge(challenge, "CANCELLED")) {
                    realtime.arenaChanged(challenge.getChallengerId(), challenge.getTargetId());
                }
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
        removeChallenge(challenge, "ACCEPTED");
        start(session);
        return session.snapshot();
    }

    @Override
    public void rejectChallenge(String challengeId, Long userId) {
        Challenge challenge = challenges.get(challengeId);
        if (challenge == null) return;
        synchronized (challenge) {
            if (challenges.get(challengeId) == challenge && "PENDING".equals(challenge.getStatus()) && challenge.getTargetId().equals(userId)) {
                removeChallenge(challenge, "REJECTED");
                realtime.arenaChanged(challenge.getChallengerId(), challenge.getTargetId());
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
        if (challenge == null) throw new IllegalArgumentException(STALE_CHALLENGE);
        synchronized (challenge) {
            if (challenges.get(challengeId) != challenge || !"PENDING".equals(challenge.getStatus()) || !challenge.getChallengerId().equals(userId)) {
                throw new IllegalArgumentException(STALE_CHALLENGE);
            }
            removeChallenge(challenge, "CANCELLED");
            realtime.arenaChanged(challenge.getChallengerId(), challenge.getTargetId());
        }
    }

    // A challenge between players who closed Hackademy or logged out would wait forever; drop it once either
    // side has been gone for a while. Each player has their own clock, so one leaving never inherits another's time.
    @Scheduled(fixedRate = 5_000)
    public void sweepAbandonedChallenges() {
        long now = clock.getAsLong();
        sweepHistory(now);
        var involved = new HashSet<Long>();
        challenges.values().forEach(challenge -> {
            involved.add(challenge.getChallengerId());
            involved.add(challenge.getTargetId());
        });
        playerGoneSince.keySet().retainAll(involved);
        for (Long player : involved) {
            if (presence.isConnected(player)) playerGoneSince.remove(player);
            else playerGoneSince.putIfAbsent(player, now);
        }
        for (Challenge challenge : challenges.values()) {
            long age = now - challengeCreatedAt.getOrDefault(challenge.getId(), now);
            if (age < 120_000 && !goneLongEnough(challenge.getChallengerId(), now) && !goneLongEnough(challenge.getTargetId(), now)) continue;
            synchronized (challenge) {
                if (challenges.get(challenge.getId()) == challenge && removeChallenge(challenge, "CANCELLED")) {
                    realtime.arenaChanged(challenge.getChallengerId(), challenge.getTargetId());
                }
            }
        }
    }

    private void sweepHistory(long now) {
        var expired = finishedAt.entrySet().stream().sorted(Map.Entry.comparingByValue()).toList();
        int excess = Math.max(0, expired.size() - 512);
        for (var entry : expired) {
            if (now - entry.getValue() < 300_000 && excess-- <= 0) continue;
            var session = activeGames.get(entry.getKey());
            if (session == null) { finishedAt.remove(entry.getKey()); continue; }
            synchronized (session) {
                if (!"FINISHED".equals(session.getStatus())) continue;
                activeGames.remove(entry.getKey(), session);
                for (Long person : session.people()) currentGames.remove(person, entry.getKey());
                finishedAt.remove(entry.getKey());
            }
        }
        recentReactions.forEach((id, sent) -> {
            synchronized (sent) {
                if (sent.isEmpty() || now - sent.peekLast() >= REACTION_WINDOW_MILLIS) recentReactions.remove(id, sent);
            }
        });
    }

    private boolean goneLongEnough(Long player, long now) {
        Long since = playerGoneSince.get(player);
        return since != null && now - since >= PLAYER_GONE_MILLIS;
    }
}
