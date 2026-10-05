package com.hackademy.server.room.dto;

import com.hackademy.server.room.DifficultyLevel;
import lombok.Builder;
import java.time.LocalDateTime;

@Builder
public record RoomDto(
    Long id,
    String title,
    String description,
    String shortDescription,
    DifficultyLevel difficulty,
    String category,
    int points,
    int solutionsCount,
    boolean solved,
    boolean requiresVpn,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {}
