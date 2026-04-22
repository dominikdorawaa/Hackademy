package com.hackademy.server.service;

import com.hackademy.server.model.GameSession;
import com.hackademy.server.model.Room;
import com.hackademy.server.model.User;
import com.hackademy.server.repository.RoomRepository;
import com.hackademy.server.repository.UserRepository;
import com.hackademy.server.repository.UserSolvedRoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MatchmakingServiceImpl implements MatchmakingService {

    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final UserSolvedRoomRepository userSolvedRoomRepository;

    // Queue stores user IDs
    private final Queue<PlayerInfo> queue = new ConcurrentLinkedQueue<>();

    private static class PlayerInfo {
        Long id;
        String username;
        boolean vpnEnabled; // New field to track if user wants VPN rooms

        PlayerInfo(Long id, String username, boolean vpnEnabled) {
            this.id = id;
            this.username = username;
            this.vpnEnabled = vpnEnabled;
        }
    }

    @Override
    public void joinQueue(Long userId, String username, boolean vpnEnabled) {
        // Check if already in queue
        if (queue.stream().noneMatch(p -> p.id.equals(userId))) {
            System.out.println("Adding user to queue: " + username + " (VPN: " + vpnEnabled + ")");
            queue.add(new PlayerInfo(userId, username, vpnEnabled));
        } else {
            System.out.println("User already in queue: " + username);
        }
    }

    @Override
    public void leaveQueue(Long userId) {
        System.out.println("Removing user from queue: " + userId);
        queue.removeIf(p -> p.id.equals(userId));
    }

    @Override
    public List<GameSession> checkForMatches() {
        List<GameSession> newSessions = new ArrayList<>();

        if (queue.size() < 2) {
            return newSessions;
        }

        System.out.println("Queue size: " + queue.size() + ". Attempting to match...");

        // Convert queue to list for easier manipulation
        List<PlayerInfo> players = new ArrayList<>(queue);
        Set<Long> matchedPlayerIds = new HashSet<>();

        // Pre-fetch room IDs to avoid fetching full entities
        // We fetch two lists: all rooms (if both players want VPN) and non-VPN rooms (if at least one doesn't)
        List<Long> allRoomIds = roomRepository.findCtfIdsByVpnRequirement(true);
        List<Long> noVpnRoomIds = roomRepository.findCtfIdsByVpnRequirement(false);

        if (allRoomIds.isEmpty() && noVpnRoomIds.isEmpty()) {
            System.out.println("No rooms found in database!");
            return newSessions;
        }

        // Try to match players
        for (int i = 0; i < players.size(); i++) {
            PlayerInfo p1 = players.get(i);
            if (matchedPlayerIds.contains(p1.id)) continue;

            for (int j = i + 1; j < players.size(); j++) {
                PlayerInfo p2 = players.get(j);
                if (matchedPlayerIds.contains(p2.id)) continue;

                // Check compatibility
                boolean canUseVpn = p1.vpnEnabled && p2.vpnEnabled;

                // Select eligible room IDs
                List<Long> eligibleRoomIds = canUseVpn ? allRoomIds : noVpnRoomIds;

                if (eligibleRoomIds.isEmpty()) {
                    System.out.println("No eligible rooms for " + p1.username + " and " + p2.username);
                    continue;
                }

                // Select random room ID
                Long randomRoomId = eligibleRoomIds.get(new Random().nextInt(eligibleRoomIds.size()));
                
                // Fetch the single room entity
                Room selectedRoom = roomRepository.findById(randomRoomId).orElse(null);
                
                if (selectedRoom == null) {
                     System.out.println("Failed to fetch room with ID: " + randomRoomId);
                     continue;
                }

                System.out.println("Matching " + p1.username + " vs " + p2.username + " in room: " + selectedRoom.getTitle());

                // Create session
                GameSession session = createGameSession(p1, p2, selectedRoom);
                if (session != null) {
                    newSessions.add(session);
                    matchedPlayerIds.add(p1.id);
                    matchedPlayerIds.add(p2.id);
                    break; // Move to next p1
                }
            }
        }

        // Remove matched players from queue
        queue.removeIf(p -> matchedPlayerIds.contains(p.id));

        return newSessions;
    }

    private GameSession createGameSession(PlayerInfo p1, PlayerInfo p2, Room room) {
        User user1 = userRepository.findById(p1.id).orElse(null);
        User user2 = userRepository.findById(p2.id).orElse(null);

        if (user1 == null || user2 == null) {
            System.out.println("One of the users not found in DB");
            return null;
        }

        GameSession session = new GameSession();
        session.setId(UUID.randomUUID().toString());
        session.setPlayer1Id(p1.id);
        session.setPlayer1Username(p1.username);
        session.setPlayer1Elo(user1.getElo());

        session.setPlayer2Id(p2.id);
        session.setPlayer2Username(p2.username);
        session.setPlayer2Elo(user2.getElo());

        session.setRoomId(room.getId());
        session.setStartTime(LocalDateTime.now());
        session.setStatus("ACTIVE");
        session.setWinnerId(null);

        // Initialize maps
        session.setHintsUsed(new HashMap<>());
        session.setFinishTimes(new HashMap<>());
        session.setPenaltiesInSeconds(new HashMap<>());

        return session;
    }
}
