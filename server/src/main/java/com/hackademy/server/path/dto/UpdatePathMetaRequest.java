package com.hackademy.server.path.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdatePathMetaRequest(
    @NotBlank @Size(max = 120) String title,
    @Size(max = 20000) String description,
    String bannerUrl
) {}
