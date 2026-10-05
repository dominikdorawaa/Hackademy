package com.hackademy.server.room.dto;

import com.hackademy.server.room.DifficultyLevel;
import com.hackademy.server.room.RoomType;
import lombok.Builder;
import java.time.LocalDateTime;
import java.util.List;

@Builder
public record RoomAdminDto(
    Long id,
    String title,
    String description,
    String shortDescription,
    DifficultyLevel difficulty,
    String category,
    int points,
    String flag,
    int solutionsCount,
    boolean requiresVpn,
    RoomType roomType,
    List<String> hints,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {}
