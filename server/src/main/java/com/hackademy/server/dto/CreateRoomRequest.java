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
public class CreateRoomRequest {

    @NotBlank(message = "Tytuł jest wymagany")
    private String title;

    @NotBlank(message = "Opis jest wymagany")
    private String description;

    private String shortDescription;

    @NotNull(message = "Poziom trudności jest wymagany")
    private DifficultyLevel difficulty;

    @NotBlank(message = "Kategoria jest wymagana")
    private String category;

    @NotNull(message = "Punkty są wymagane")
    @Min(value = 0, message = "Liczba punktów nie może być ujemna")
    private Integer points;

    @NotBlank(message = "Flaga jest wymagana")
    private String flag;

    private boolean requiresVpn;
    // CTF rooms appear in Arena; PATH rooms are only inside learning paths
    private RoomType roomType = RoomType.CTF;

    private List<String> hints;
}
