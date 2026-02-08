package com.hackademy.server.service;

import com.hackademy.server.model.GameSession;
import com.hackademy.server.model.Room;
import com.hackademy.server.model.User;
import com.hackademy.server.repository.RoomRepository;
import com.hackademy.server.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedQueue;

@Service
@RequiredArgsConstructor
public class MatchmakingServiceImpl implements MatchmakingService {

    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    
    // Queue stores user IDs
    private final Queue<PlayerInfo> queue = new ConcurrentLinkedQueue<>();
    
    private static class PlayerInfo {
        Long id;
        String username;
        
        PlayerInfo(Long id, String username) {
            this.id = id;
            this.username = username;
        }
    }

    @Override
    public void joinQueue(Long userId, String username) {
        // Check if already in queue
        if (queue.stream().noneMatch(p -> p.id.equals(userId))) {
            System.out.println("Adding user to queue: " + username);
            queue.add(new PlayerInfo(userId, username));
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

        // Fetch all room IDs (lightweight)
        List<Long> roomIds = roomRepository.findAllIds();
        if (roomIds.isEmpty()) {
            System.out.println("No rooms found in database!");
            return newSessions;
        }

        // Process queue until less than 2 players remain
        while (queue.size() >= 2) {
            // Select random room ID
            Long randomRoomId = roomIds.get(new Random().nextInt(roomIds.size()));
            Room randomRoom = roomRepository.findById(randomRoomId).orElse(null);
            
            if (randomRoom == null) {
                System.out.println("Failed to fetch room with ID: " + randomRoomId);
                break; 
            }
            
            PlayerInfo p1 = queue.poll();
            PlayerInfo p2 = queue.poll();
            
            if (p1 == null || p2 == null) {
                if (p1 != null) queue.add(p1);
                if (p2 != null) queue.add(p2);
                break;
            }
            
            System.out.println("Matching " + p1.username + " vs " + p2.username);

            // Fetch users to get ELO
            User user1 = userRepository.findById(p1.id).orElse(null);
            User user2 = userRepository.findById(p2.id).orElse(null);
            
            if (user1 == null || user2 == null) {
                 System.out.println("One of the users not found in DB");
                 continue;
            }

            GameSession session = new GameSession();
            session.setId(UUID.randomUUID().toString());
            session.setPlayer1Id(p1.id);
            session.setPlayer1Username(p1.username);
            session.setPlayer1Elo(user1.getElo());
            
            session.setPlayer2Id(p2.id);
            session.setPlayer2Username(p2.username);
            session.setPlayer2Elo(user2.getElo());

            session.setRoomId(randomRoom.getId());
            session.setStartTime(LocalDateTime.now());
            session.setStatus("ACTIVE");
            session.setWinnerId(null);
            
            // Initialize maps
            session.setHintsUsed(new HashMap<>());
            session.setFinishTimes(new HashMap<>());
            session.setPenaltiesInSeconds(new HashMap<>());
            
            newSessions.add(session);
        }
        
        return newSessions;
    }
}
