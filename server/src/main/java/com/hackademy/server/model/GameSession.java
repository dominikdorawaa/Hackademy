package com.hackademy.server.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GameSession {
    private String id;
    private Long player1Id;
    private String player1Username;
    private Integer player1Elo; // Initial ELO
    
    private Long player2Id;
    private String player2Username;
    private Integer player2Elo; // Initial ELO
    
    private Long roomId;
    private LocalDateTime startTime;
    private String status; // ACTIVE, FINISHED, WAITING_FOR_OPPONENT
    private Long winnerId;
    
    private Integer player1EloChange;
    private Integer player2EloChange;
    
    // New fields for time penalty mechanics
    // Changed from Integer count to List of Hint IDs
    private Map<Long, List<Long>> hintsUsed = new HashMap<>(); // userId -> List<HintId>
    private Map<Long, LocalDateTime> finishTimes = new HashMap<>(); // userId -> finishTime
    private Map<Long, Long> penaltiesInSeconds = new HashMap<>(); // userId -> penalty seconds
    
    public void addHintUsage(Long userId, Long hintId) {
        hintsUsed.computeIfAbsent(userId, k -> new ArrayList<>()).add(hintId);
        penaltiesInSeconds.put(userId, penaltiesInSeconds.getOrDefault(userId, 0L) + 120L); // +2 minutes per hint
    }
    
    public long getTotalTimeInSeconds(Long userId) {
        if (!finishTimes.containsKey(userId)) return -1;
        
        long duration = java.time.Duration.between(startTime, finishTimes.get(userId)).getSeconds();
        return duration + penaltiesInSeconds.getOrDefault(userId, 0L);
    }
}
