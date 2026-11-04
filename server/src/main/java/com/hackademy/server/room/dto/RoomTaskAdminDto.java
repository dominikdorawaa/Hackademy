package com.hackademy.server.room.dto;

import java.util.List;

public record RoomTaskAdminDto(
    Long id,
    String title,
    String content,
    String question,
    String answer,
    List<String> hints
) {}
