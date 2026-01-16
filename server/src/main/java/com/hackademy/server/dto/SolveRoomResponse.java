package com.hackademy.server.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SolveRoomResponse {
    private boolean success;
    private String message;
    private int pointsEarned;
    private List<BadgeDto> newBadges;
}
