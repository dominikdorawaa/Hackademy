package com.hackademy.server.room.dto;

import com.hackademy.server.room.DifficultyLevel;
import java.time.LocalDateTime;

public record RecentSolvedRoomDto(
    Long roomId,
    String title,
    DifficultyLevel difficulty,
    int points,
    LocalDateTime solvedAt
) {}
