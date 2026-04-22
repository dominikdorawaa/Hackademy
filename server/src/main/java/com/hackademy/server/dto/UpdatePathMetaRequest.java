package com.hackademy.server.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdatePathMetaRequest {
    @NotBlank
    @Size(max = 120)
    private String title;

    private String description;

    private String bannerUrl;
}

