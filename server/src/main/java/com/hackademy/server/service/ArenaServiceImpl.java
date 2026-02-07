package com.hackademy.server.service;

import com.hackademy.server.model.Challenge;
import com.hackademy.server.model.Friendship;
import com.hackademy.server.model.GameSession;
import com.hackademy.server.model.Room;
import com.hackademy.server.model.User;
import com.hackademy.server.repository.FriendshipRepository;
import com.hackademy.server.repository.RoomRepository;
import com.hackademy.server.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ArenaServiceImpl implements ArenaService {

    private final RoomRepository roomRepository;
    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;
    private final ChatService chatService;

    // In-memory storage
    private final Map<String, GameSession> activeGames = new ConcurrentHashMap<>();
    private final Map<String, Challenge> challenges = new ConcurrentHashMap<>();

    @Override
    public void addGame(GameSession session) {
        activeGames.put(session.getId(), session);
    }

    @Override
    public GameSession getGameSession(String gameId) {
        return activeGames.get(gameId);
    }

    @Override
    public void finishGame(String gameId, Long winnerId) {
        GameSession session = activeGames.get(gameId);
        if (session != null) {
            session.setStatus("FINISHED");
            session.setWinnerId(winnerId);

            Long loserId = session.getPlayer1Id().equals(winnerId) ? session.getPlayer2Id() : session.getPlayer1Id();
            
            Optional<User> winnerOpt = userRepository.findById(winnerId);
            Optional<User> loserOpt = userRepository.findById(loserId);

            if (winnerOpt.isPresent() && loserOpt.isPresent()) {
                User winner = winnerOpt.get();
                User loser = loserOpt.get();

                // ELO Calculation
                updateElo(winner, loser, session);
                userRepository.save(winner);
                userRepository.save(loser);

                // Update friendship stats if they are friends
                Optional<Friendship> friendship = friendshipRepository.findFriendshipBetween(winner, loser);
                if (friendship.isPresent()) {
                    Friendship f = friendship.get();
                    if (f.getRequester().getId().equals(winnerId)) {
                        f.setRequesterWins(f.getRequesterWins() + 1);
                    } else {
                        f.setReceiverWins(f.getReceiverWins() + 1);
                    }
                    friendshipRepository.save(f);
                }
            }
            
            // Cleanup chat (keep reported messages)
            chatService.cleanupChat(gameId);
        }
    }

    private void updateElo(User winner, User loser, GameSession session) {
        int K = 32; // K-factor

        double winnerExpected = 1.0 / (1.0 + Math.pow(10.0, (loser.getElo() - winner.getElo()) / 400.0));
        double loserExpected = 1.0 / (1.0 + Math.pow(10.0, (winner.getElo() - loser.getElo()) / 400.0));

        int winnerNewElo = (int) Math.round(winner.getElo() + K * (1.0 - winnerExpected));
        int loserNewElo = (int) Math.round(loser.getElo() + K * (0.0 - loserExpected));
        
        // Ensure ELO doesn't drop below 0
        loserNewElo = Math.max(0, loserNewElo);

        int winnerChange = winnerNewElo - winner.getElo();
        int loserChange = loserNewElo - loser.getElo();

        winner.setElo(winnerNewElo);
        loser.setElo(loserNewElo);
        
        // Save changes to session
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
                .filter(g -> (g.getPlayer1Id().equals(userId) || g.getPlayer2Id().equals(userId)) && ("ACTIVE".equals(g.getStatus()) || "WAITING_FOR_OPPONENT".equals(g.getStatus())))
                .findFirst()
                .orElse(null);
    }

    @Override
    public GameSession findCurrentGameForUser(Long userId) {
        return activeGames.values().stream()
                .filter(g -> (g.getPlayer1Id().equals(userId) || g.getPlayer2Id().equals(userId)))
                .sorted((g1, g2) -> {
                    boolean g1Active = "ACTIVE".equals(g1.getStatus()) || "WAITING_FOR_OPPONENT".equals(g1.getStatus());
                    boolean g2Active = "ACTIVE".equals(g2.getStatus()) || "WAITING_FOR_OPPONENT".equals(g2.getStatus());
                    
                    if (g1Active && !g2Active) return -1;
                    if (!g1Active && g2Active) return 1;
                    return g2.getStartTime().compareTo(g1.getStartTime()); // Newest first
                })
                .findFirst()
                .orElse(null);
    }

    @Override
    public void useHint(String gameId, Long userId, Long hintId) {
        GameSession session = activeGames.get(gameId);
        // Allow using hints if game is ACTIVE or WAITING_FOR_OPPONENT (meaning the other player finished but this one is still playing)
        if (session != null && ("ACTIVE".equals(session.getStatus()) || "WAITING_FOR_OPPONENT".equals(session.getStatus()))) {
            session.addHintUsage(userId, hintId);
        }
    }
    
    @Override
    public void surrenderGame(String gameId, Long userId) {
        GameSession session = activeGames.get(gameId);
        if (session != null && ("ACTIVE".equals(session.getStatus()) || "WAITING_FOR_OPPONENT".equals(session.getStatus()))) {
            Long opponentId = session.getPlayer1Id().equals(userId) ? session.getPlayer2Id() : session.getPlayer1Id();
            finishGame(gameId, opponentId);
        }
    }

    @Override
    public boolean submitFlag(String gameId, Long userId, String flag) {
        GameSession session = activeGames.get(gameId);
        if (session == null || (!"ACTIVE".equals(session.getStatus()) && !"WAITING_FOR_OPPONENT".equals(session.getStatus()))) {
            return false;
        }

        Room room = roomRepository.findById(session.getRoomId()).orElse(null);
        if (room == null) {
            return false;
        }

        if (room.getFlag().equals(flag)) {
            // Mark user as finished
            session.getFinishTimes().put(userId, LocalDateTime.now());
            
            Long opponentId = session.getPlayer1Id().equals(userId) ? session.getPlayer2Id() : session.getPlayer1Id();
            
            // Check if opponent already finished
            if (session.getFinishTimes().containsKey(opponentId)) {
                // Both finished, calculate winner based on total time (duration + penalties)
                long userTime = session.getTotalTimeInSeconds(userId);
                long opponentTime = session.getTotalTimeInSeconds(opponentId);
                
                if (userTime < opponentTime) {
                    finishGame(gameId, userId);
                } else {
                    finishGame(gameId, opponentId);
                }
            } else {
                // Opponent hasn't finished yet.
                // We ALWAYS wait for opponent unless they already lost by time.
                // But since we don't know if they will take hints or finish instantly, we just wait.
                // The scheduled task will handle the timeout logic.
                session.setStatus("WAITING_FOR_OPPONENT");
            }
            return true;
        }
        return false;
    }
    
    // Scheduled task to check WAITING_FOR_OPPONENT games
    @Scheduled(fixedRate = 2000)
    public void checkWaitingGames() {
        LocalDateTime now = LocalDateTime.now();
        
        for (GameSession session : activeGames.values()) {
            if ("WAITING_FOR_OPPONENT".equals(session.getStatus())) {
                // Find who finished (the one waiting)
                Long finishedUserId = null;
                Long playingUserId = null;
                
                if (session.getFinishTimes().containsKey(session.getPlayer1Id())) {
                    finishedUserId = session.getPlayer1Id();
                    playingUserId = session.getPlayer2Id();
                } else {
                    finishedUserId = session.getPlayer2Id();
                    playingUserId = session.getPlayer1Id();
                }
                
                // Calculate the finished user's final score (time + penalties)
                long finishedUserScore = session.getTotalTimeInSeconds(finishedUserId);
                
                // Calculate how long the playing user has been playing so far PLUS their penalties
                long currentPlayingDuration = java.time.Duration.between(session.getStartTime(), now).getSeconds();
                long currentPlayingPenalties = session.getPenaltiesInSeconds().getOrDefault(playingUserId, 0L);
                long currentPlayingTotalScore = currentPlayingDuration + currentPlayingPenalties;
                
                // If the playing user's CURRENT total score (time + penalties) has ALREADY exceeded the finished user's score,
                // the finished user wins immediately.
                if (currentPlayingTotalScore > finishedUserScore) {
                    finishGame(session.getId(), finishedUserId);
                }
            }
        }
    }

    @Override
    public Challenge createChallenge(Long challengerId, String challengerUsername, Long targetId, String targetUsername) {
        Challenge challenge = new Challenge(
                UUID.randomUUID().toString(),
                challengerId,
                challengerUsername,
                targetId,
                targetUsername,
                LocalDateTime.now(),
                "PENDING"
        );
        challenges.put(challenge.getId(), challenge);
        return challenge;
    }

    @Override
    public GameSession acceptChallenge(String challengeId, Long userId) {
        Challenge challenge = challenges.get(challengeId);
        if (challenge == null || !challenge.getTargetId().equals(userId) || !"PENDING".equals(challenge.getStatus())) {
            throw new IllegalArgumentException("Invalid challenge");
        }

        // Create game session
        List<Room> rooms = roomRepository.findAll();
        if (rooms.isEmpty()) {
            throw new IllegalStateException("No rooms available");
        }
        Room randomRoom = rooms.get(new Random().nextInt(rooms.size()));
        
        // Fetch users to get ELO
        User challenger = userRepository.findById(challenge.getChallengerId()).orElse(null);
        User target = userRepository.findById(challenge.getTargetId()).orElse(null);
        
        if (challenger == null || target == null) {
             throw new IllegalStateException("Users not found");
        }

        GameSession session = new GameSession();
        session.setId(UUID.randomUUID().toString());
        session.setPlayer1Id(challenge.getChallengerId());
        session.setPlayer1Username(challenge.getChallengerUsername());
        session.setPlayer1Elo(challenger.getElo());
        
        session.setPlayer2Id(challenge.getTargetId());
        session.setPlayer2Username(challenge.getTargetUsername());
        session.setPlayer2Elo(target.getElo());

        session.setRoomId(randomRoom.getId());
        session.setStartTime(LocalDateTime.now());
        session.setStatus("ACTIVE");
        
        // Initialize maps
        session.setHintsUsed(new java.util.HashMap<>());
        session.setFinishTimes(new java.util.HashMap<>());
        session.setPenaltiesInSeconds(new java.util.HashMap<>());

        activeGames.put(session.getId(), session);
        challenge.setStatus("ACCEPTED");
        
        // Remove challenge after acceptance
        challenges.remove(challengeId);
        
        return session;
    }

    @Override
    public void rejectChallenge(String challengeId, Long userId) {
        Challenge challenge = challenges.get(challengeId);
        if (challenge != null && challenge.getTargetId().equals(userId)) {
            challenge.setStatus("REJECTED");
            challenges.remove(challengeId);
        }
    }

    @Override
    public List<Challenge> getPendingChallenges(Long userId) {
        return challenges.values().stream()
                .filter(c -> c.getTargetId().equals(userId) && "PENDING".equals(c.getStatus()))
                .collect(Collectors.toList());
    }
}
