package com.hackademy.server.path.dto;

import lombok.Builder;
import java.util.List;

@Builder
public record PathAdminDetailDto(
    Long id,
    String title,
    String description,
    String bannerUrl,
    boolean hasBanner,
    List<Long> roomIds
) {}
