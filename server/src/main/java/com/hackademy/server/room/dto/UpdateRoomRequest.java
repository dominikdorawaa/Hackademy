package com.hackademy.server.room.dto;

import com.hackademy.server.room.DifficultyLevel;
import com.hackademy.server.room.RoomDescription;
import com.hackademy.server.room.RoomType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotNull;

public record UpdateRoomRequest(
        @NotBlank(message = "Tytuł nie może być pusty") @Size(max = 255) String title,
        @NotBlank(message = "Opis nie może być pusty") @Size(max = RoomDescription.MAX_LENGTH) String description,
        @NotNull(message = "Poziom trudności nie może być pusty") DifficultyLevel difficulty,
        @NotBlank(message = "Kategoria nie może być pusta") @Size(max = 255) String category,
        Integer points,
        boolean requiresVpn,
        RoomType roomType
) {
}
