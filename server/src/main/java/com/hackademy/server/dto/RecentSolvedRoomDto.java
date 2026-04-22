package com.hackademy.server.dto;

import com.hackademy.server.model.DifficultyLevel;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RecentSolvedRoomDto {
    private Long roomId;
    private String title;
    private DifficultyLevel difficulty;
    private int points;
    private LocalDateTime solvedAt;
}

