package com.hackademy.server.dto;

import com.hackademy.server.model.DifficultyLevel;
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
    private LocalDateTime createdAt;
    
    // Constructor for JPQL query (without solved status, which is calculated later)
    public RoomSummaryDto(Long id, String title, String shortDescription, DifficultyLevel difficulty, String category, int points, int solutionsCount, LocalDateTime createdAt) {
        this.id = id;
        this.title = title;
        this.shortDescription = shortDescription;
        this.difficulty = difficulty;
        this.category = category;
        this.points = points;
        this.solutionsCount = solutionsCount;
        this.createdAt = createdAt;
        this.solved = false; // Default
    }
}
