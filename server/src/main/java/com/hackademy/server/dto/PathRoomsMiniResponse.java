package com.hackademy.server.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PathRoomsMiniResponse {
    private Long pathId;
    private List<PathRoomMiniDto> rooms;
}

