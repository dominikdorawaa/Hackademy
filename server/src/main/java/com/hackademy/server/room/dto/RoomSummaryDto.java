package com.hackademy.server.room.dto;

import com.hackademy.server.room.DifficultyLevel;
import com.hackademy.server.room.RoomType;
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
    private String description;
    private DifficultyLevel difficulty;
    private String category;
    private int points;
    private int solutionsCount;
    private boolean solved;
    private boolean locked;
    private boolean premium;
    private boolean requiresVpn;
    private RoomType roomType;
    private LocalDateTime createdAt;

    public RoomSummaryDto(Long id, String title, String description, DifficultyLevel difficulty, String category,
            int points, int solutionsCount, boolean requiresVpn, RoomType roomType, LocalDateTime createdAt) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.difficulty = difficulty;
        this.category = category;
        this.points = points;
        this.solutionsCount = solutionsCount;
        this.requiresVpn = requiresVpn;
        this.roomType = roomType;
        this.createdAt = createdAt;
        this.solved = false;
        this.locked = false;
    }

    public String getShortDescription() {
        return description;
    }
}
