package com.hackademy.server.room.dto;

import lombok.Builder;

@Builder
public record RoomTaskDto(
    Long id,
    String title,
    String content,
    String question,
    boolean completed
) {}
