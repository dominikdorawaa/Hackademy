package com.hackademy.server.room.dto;

import com.hackademy.server.room.DifficultyLevel;
import com.hackademy.server.room.RoomType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record UpdateRoomRequest(
        @NotBlank(message = "Tytuł nie może być pusty") @Size(max = 255) String title,
        @NotBlank(message = "Opis nie może być pusty") @Size(max = 20000) String description,
        @Size(max = 100) String shortDescription,
        @NotNull(message = "Poziom trudności nie może być pusty") DifficultyLevel difficulty,
        @NotBlank(message = "Kategoria nie może być pusta") @Size(max = 255) String category,
        @Min(value = 0, message = "Liczba punktów nie może być ujemna") Integer points,
        @NotBlank(message = "Flaga nie może być pusta") @Size(max = 255) String flag,
        boolean requiresVpn,
        RoomType roomType,
        @Size(max = 100) List<@NotBlank @Size(max = 2000) String> hints
) {
    public UpdateRoomRequest {
        if (roomType == null) roomType = RoomType.CTF;
    }
}
