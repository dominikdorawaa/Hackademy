package com.hackademy.server.path.dto;

import com.hackademy.server.room.dto.RoomSummaryDto;
import java.util.List;

public record PathChapterDto(
    Long id,
    String title,
    int totalRooms,
    int solvedRooms,
    List<RoomSummaryDto> rooms
) {}
