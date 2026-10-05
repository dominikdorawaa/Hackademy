package com.hackademy.server.path.dto;

import lombok.Builder;

@Builder
public record PathSummaryDto(
    Long id,
    String title,
    String description,
    String bannerUrl,
    boolean hasBanner,
    int roomsCount,
    boolean enrolled
) {}
