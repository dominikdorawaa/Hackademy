package com.hackademy.server.room.dto;

import com.hackademy.server.room.DifficultyLevel;
import com.hackademy.server.room.RoomType;

import java.util.List;

public record RoomAdminSummaryDto(
    Long id,
    String title,
    String category,
    DifficultyLevel difficulty,
    int points,
    boolean requiresVpn,
    RoomType roomType,
    List<RoomPathDto> paths
) {
    public RoomAdminSummaryDto(Long id, String title, String category, DifficultyLevel difficulty, int points,
                               boolean requiresVpn, RoomType roomType) {
        this(id, title, category, difficulty, points, requiresVpn, roomType, List.of());
    }

    public RoomAdminSummaryDto withPaths(List<RoomPathDto> paths) {
        return new RoomAdminSummaryDto(id, title, category, difficulty, points, requiresVpn, roomType, paths);
    }
}
