package com.hackademy.server.dto;

import com.hackademy.server.model.DifficultyLevel;
import com.hackademy.server.model.RoomType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomSummaryDto {
    private Long id;
    private String title;
    private String shortDescription; // Only short description
    private DifficultyLevel difficulty;
    private String category;
    private int points;
    private int solutionsCount;
    private boolean solved;
    private boolean locked;
    private boolean requiresVpn; // New field
    private RoomType roomType;
    private LocalDateTime createdAt;
    
    // Constructor for JPQL query
    public RoomSummaryDto(Long id, String title, String shortDescription, DifficultyLevel difficulty, String category, int points, int solutionsCount, boolean requiresVpn, RoomType roomType, LocalDateTime createdAt) {
        this.id = id;
        this.title = title;
        this.shortDescription = shortDescription;
        this.difficulty = difficulty;
        this.category = category;
        this.points = points;
        this.solutionsCount = solutionsCount;
        this.requiresVpn = requiresVpn;
        this.roomType = roomType;
        this.createdAt = createdAt;
        this.solved = false; // Default
        this.locked = false; // Default
    }
}
