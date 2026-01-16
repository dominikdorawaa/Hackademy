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
public class RoomDto {
    private Long id;
    private String title;
    private String description;
    private String shortDescription;
    private DifficultyLevel difficulty;
    private int points;
    private int solutionsCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Flag is explicitly excluded here for users.
    // Admin view might need a separate DTO or use the Entity directly (since they have permission).
}
