package com.hackademy.server.path.dto;

import lombok.Builder;

@Builder
public record PathRoomMiniDto(
    Long id,
    String title,
    boolean solved,
    boolean locked,
    boolean requiresVpn
) {}
