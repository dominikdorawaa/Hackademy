package com.hackademy.server.room.dto;

import com.hackademy.server.badge.BadgeDto;
import java.util.List;

public record SolveRoomResponse(
    boolean success,
    String message,
    int pointsEarned,
    List<BadgeDto> newBadges
) {}
