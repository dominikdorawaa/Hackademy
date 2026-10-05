package com.hackademy.server.room.dto;

import com.hackademy.server.room.DifficultyLevel;
import com.hackademy.server.room.RoomType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record CreateRoomRequest(
        @NotBlank(message = "Tytuł jest wymagany") String title,
        @NotBlank(message = "Opis jest wymagany") String description,
        String shortDescription,
        @NotNull(message = "Poziom trudności jest wymagany") DifficultyLevel difficulty,
        @NotBlank(message = "Kategoria jest wymagana") String category,
        @NotNull(message = "Punkty są wymagane") @Min(value = 0, message = "Liczba punktów nie może być ujemna") Integer points,
        @NotBlank(message = "Flaga jest wymagana") String flag,
        boolean requiresVpn,
        RoomType roomType,
        List<String> hints
) {
    public CreateRoomRequest {
        if (roomType == null) roomType = RoomType.CTF;
    }
}
