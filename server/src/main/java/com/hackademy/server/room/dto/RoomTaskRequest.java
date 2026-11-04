package com.hackademy.server.room.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record RoomTaskRequest(
    Long id,
    @NotBlank(message = "Tytuł zadania jest wymagany") @Size(max = 255, message = "Tytuł zadania nie może przekraczać 255 znaków") String title,
    @NotBlank(message = "Treść zadania jest wymagana") @Size(max = 20000) String content,
    @Size(max = 2000) String question,
    @Size(max = 255, message = "Odpowiedź nie może przekraczać 255 znaków") String answer,
    @Size(max = RoomTaskRequest.MAX_HINTS, message = "Zadanie może mieć maksymalnie " + RoomTaskRequest.MAX_HINTS + " podpowiedzi") List<@NotBlank(message = "Podpowiedź nie może być pusta") @Size(max = 2000, message = "Podpowiedź nie może przekraczać 2000 znaków") String> hints
) {
    public static final int MAX_HINTS = 10;

    public RoomTaskRequest(Long id, String title, String content, String question, String answer) {
        this(id, title, content, question, answer, null);
    }
}
