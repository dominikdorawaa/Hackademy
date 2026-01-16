package com.hackademy.server.dto;

import com.hackademy.server.model.DifficultyLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomAdminDto {
    private Long id;
    private String title;
    private String description;
    private String shortDescription;
    private DifficultyLevel difficulty;
    private int points;
    private String flag; // Included for Admin
    private int solutionsCount;
    private List<String> hints;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
