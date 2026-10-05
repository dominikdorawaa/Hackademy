package com.hackademy.server.path.dto;

import lombok.Builder;
import java.util.List;

@Builder
public record PathRoomsMiniResponse(
    Long pathId,
    List<PathRoomMiniDto> rooms
) {}
