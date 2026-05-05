package com.hackademy.server.dto;

import com.hackademy.server.model.DifficultyLevel;
import com.hackademy.server.model.RoomType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UpdateRoomRequest {
    @NotBlank(message = "Tytuł nie może być pusty")
    private String title;

    @NotBlank(message = "Opis nie może być pusty")
    private String description;

    private String shortDescription;

    @NotNull(message = "Poziom trudności nie może być pusty")
    private DifficultyLevel difficulty;

    @NotBlank(message = "Kategoria nie może być pusta")
    private String category;

    @Min(value = 0, message = "Liczba punktów nie może być ujemna")
    private int points;

    @NotBlank(message = "Flaga nie może być pusta")
    private String flag;

    private boolean requiresVpn;

    private RoomType roomType = RoomType.CTF;

    private List<String> hints;
}
