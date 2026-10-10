package com.hackademy.server.room.dto;

public record RoomTaskAdminDto(
    Long id,
    String title,
    String content,
    String question,
    String answer
) {}
