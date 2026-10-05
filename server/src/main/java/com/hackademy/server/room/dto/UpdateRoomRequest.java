package com.hackademy.server.room.dto;

import com.hackademy.server.room.DifficultyLevel;
import com.hackademy.server.room.RoomType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record UpdateRoomRequest(
        @NotBlank(message = "Tytuł nie może być pusty") String title,
        @NotBlank(message = "Opis nie może być pusty") String description,
        String shortDescription,
        @NotNull(message = "Poziom trudności nie może być pusty") DifficultyLevel difficulty,
        @NotBlank(message = "Kategoria nie może być pusta") String category,
        @Min(value = 0, message = "Liczba punktów nie może być ujemna") int points,
        @NotBlank(message = "Flaga nie może być pusta") String flag,
        boolean requiresVpn,
        RoomType roomType,
        List<String> hints
) {
    public UpdateRoomRequest {
        if (roomType == null) roomType = RoomType.CTF;
    }
}
