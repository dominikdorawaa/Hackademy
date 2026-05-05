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
    @NotBlank(message = "Tytuł jest wymagany")
    @Size(max = 120, message = "Tytuł nie może przekraczać 120 znaków")
    private String title;

    private String description;

    private String bannerUrl;

    private List<Long> roomIds;
}
