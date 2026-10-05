package com.hackademy.server.path.dto;

import lombok.Builder;

@Builder
public record PathProgressDto(
    Long id,
    String title,
    String description,
    String bannerUrl,
    int totalRooms,
    int solvedRooms,
    boolean completed
) {}
