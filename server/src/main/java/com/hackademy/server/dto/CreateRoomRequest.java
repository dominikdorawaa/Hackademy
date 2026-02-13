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
public class CreateRoomRequest {

    @NotBlank(message = "Title is required")
    private String title;

    @NotBlank(message = "Description is required")
    private String description;

    private String shortDescription;

    @NotNull(message = "Difficulty level is required")
    private DifficultyLevel difficulty;

    @NotBlank(message = "Category is required")
    private String category;

    @NotNull(message = "Points are required")
    @Min(value = 0, message = "Points must be non-negative")
    private Integer points;

    @NotBlank(message = "Flag is required")
    private String flag;

    private boolean requiresVpn; // New field

    private List<String> hints;
}
