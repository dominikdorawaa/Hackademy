package com.hackademy.server.dto;

import com.hackademy.server.model.DifficultyLevel;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RoomAdminSummaryDto {
    private Long id;
    private String title;
    private String category;
    private DifficultyLevel difficulty;
    private int points;
    private boolean requiresVpn; // New field
}
