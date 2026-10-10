package com.hackademy.server.room.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RoomTaskRequest(
    Long id,
    @NotBlank(message = "Tytuł zadania jest wymagany") @Size(max = 255, message = "Tytuł zadania nie może przekraczać 255 znaków") String title,
    @NotBlank(message = "Treść zadania jest wymagana") String content,
    String question,
    @Size(max = 255, message = "Odpowiedź nie może przekraczać 255 znaków") String answer
) {}
