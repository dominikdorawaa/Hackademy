package com.hackademy.server.dto;

import com.hackademy.server.model.DifficultyLevel;
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
    @NotBlank(message = "Title cannot be empty")
    private String title;

    @NotBlank(message = "Description cannot be empty")
    private String description;

    private String shortDescription;

    @NotNull(message = "Difficulty cannot be null")
    private DifficultyLevel difficulty;

    @NotBlank(message = "Category cannot be empty")
    private String category;

    @Min(value = 0, message = "Points must be non-negative")
    private int points;

    @NotBlank(message = "Flag cannot be empty")
    private String flag;

    private boolean requiresVpn; // New field

    private List<String> hints;
}
