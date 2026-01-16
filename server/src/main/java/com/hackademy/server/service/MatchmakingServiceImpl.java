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
            queue.add(new PlayerInfo(userId, username));
        }
    }

    @Override
    public void leaveQueue(Long userId) {
        queue.removeIf(p -> p.id.equals(userId));
    }

    @Override
    public GameSession checkForMatch() {
        if (queue.size() >= 2) {
            PlayerInfo p1 = queue.poll();
            PlayerInfo p2 = queue.poll();
            
            if (p1 == null || p2 == null) return null; // Should not happen

            // Select random room
            List<Room> rooms = roomRepository.findAll();
            if (rooms.isEmpty()) {
                // Put players back if no rooms
                queue.add(p1);
                queue.add(p2);
                return null;
            }
            
            Room randomRoom = rooms.get(new Random().nextInt(rooms.size()));
            
            // Fetch users to get ELO
            User user1 = userRepository.findById(p1.id).orElse(null);
            User user2 = userRepository.findById(p2.id).orElse(null);
            
            if (user1 == null || user2 == null) {
                 // Handle error case, maybe put valid user back
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

            session.setRoomId(randomRoom.getId());
            session.setStartTime(LocalDateTime.now());
            session.setStatus("ACTIVE");
            session.setWinnerId(null);
            
            // Initialize maps
            session.setHintsUsed(new HashMap<>());
            session.setFinishTimes(new HashMap<>());
            session.setPenaltiesInSeconds(new HashMap<>());
            
            return session;
        }
        return null;
    }
}
