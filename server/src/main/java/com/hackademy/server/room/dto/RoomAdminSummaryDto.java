package com.hackademy.server.room.dto;

import com.hackademy.server.room.DifficultyLevel;
import com.hackademy.server.room.RoomType;

public record RoomAdminSummaryDto(
    Long id,
    String title,
    String category,
    DifficultyLevel difficulty,
    int points,
    boolean requiresVpn,
    RoomType roomType
) {}
