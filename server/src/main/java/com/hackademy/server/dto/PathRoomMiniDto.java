package com.hackademy.server.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PathRoomMiniDto {
    private Long id;
    private String title;
    private boolean solved;
    private boolean locked;
    private boolean requiresVpn;
}

