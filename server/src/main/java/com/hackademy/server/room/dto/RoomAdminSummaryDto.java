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
    boolean published,
    List<RoomPathDto> paths
) {
    public RoomAdminSummaryDto(Long id, String title, String category, DifficultyLevel difficulty, int points,
                               boolean requiresVpn, RoomType roomType, boolean published) {
        this(id, title, category, difficulty, points, requiresVpn, roomType, published, List.of());
    }

    public RoomAdminSummaryDto withPaths(List<RoomPathDto> paths) {
        return new RoomAdminSummaryDto(id, title, category, difficulty, points, requiresVpn, roomType, published, paths);
    }
}
