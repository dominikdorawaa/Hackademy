package com.hackademy.server.room.dto;

import com.hackademy.server.room.DifficultyLevel;
import com.hackademy.server.room.RoomType;
import lombok.Builder;
import java.time.LocalDateTime;

@Builder
public record RoomAdminDto(
    Long id,
    long contentRevision,
    String title,
    String description,
    String shortDescription,
    DifficultyLevel difficulty,
    String category,
    int points,
    int solutionsCount,
    boolean requiresVpn,
    RoomType roomType,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {}
