package com.hackademy.server.room.dto;

import lombok.Builder;

import java.util.List;

@Builder
public record RoomTaskDto(
    Long id,
    String title,
    String content,
    String question,
    boolean requiresAnswer,
    boolean completed,
    List<HintDto> hints
) {}
