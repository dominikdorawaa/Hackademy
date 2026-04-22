package com.hackademy.server.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreatePathRequest {
    @NotBlank
    @Size(max = 120)
    private String title;

    private String description;

    // Optional: initial set of room IDs in order
    private List<Long> roomIds;
}

