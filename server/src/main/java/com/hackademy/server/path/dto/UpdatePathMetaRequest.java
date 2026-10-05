package com.hackademy.server.path.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdatePathMetaRequest(
    @NotBlank @Size(max = 120) String title,
    String description,
    String bannerUrl
) {}
