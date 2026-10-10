package com.hackademy.server.path.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ChapterRequest(
    Long id,
    @NotBlank(message = "Nazwa rozdziału jest wymagana") @Size(max = 120, message = "Nazwa rozdziału nie może przekraczać 120 znaków") String title,
    List<Long> roomIds
) {}
