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
    private String category;
    private int points;
    private int solutionsCount;
    private boolean solved;
    private boolean requiresVpn; // New field
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
