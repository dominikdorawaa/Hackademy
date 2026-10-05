package com.hackademy.server.room.dto;

import com.hackademy.server.room.DifficultyLevel;
import lombok.Builder;
import java.time.LocalDateTime;
import java.util.List;

@Builder
public record RoomDetailDto(
    Long id,
    String title,
    String description,
    String shortDescription,
    DifficultyLevel difficulty,
    int points,
    int solutionsCount,
    LocalDateTime createdAt,
    boolean solved,
    boolean requiresVpn,
    List<HintDto> hints,
    List<Long> unlockedHintIds,
    String fileName,
    List<RoomTaskDto> tasks
) {}
