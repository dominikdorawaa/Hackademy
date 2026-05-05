package com.hackademy.server.dto;

import com.hackademy.server.model.DifficultyLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomDetailDto {
    private Long id;
    private String title;
    private String description;
    private String shortDescription;
    private DifficultyLevel difficulty;
    private int points;
    private int solutionsCount;
    private LocalDateTime createdAt;
    private boolean solved;
    private boolean requiresVpn;
    private List<HintDto> hints;
    private List<Long> unlockedHintIds;
    private String fileName;
    private List<RoomTaskDto> tasks;
}
