package com.hackademy.server.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PathProgressDto {
    private Long id;
    private String title;
    private String description;
    private String bannerUrl;
    private int totalRooms;
    private int solvedRooms;
    private boolean completed;
}

