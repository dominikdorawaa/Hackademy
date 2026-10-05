package com.hackademy.server.path.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record CreatePathRequest(
    @NotBlank(message = "Tytuł jest wymagany") @Size(max = 120, message = "Tytuł nie może przekraczać 120 znaków") String title,
    String description,
    String bannerUrl,
    List<Long> roomIds
) {}
