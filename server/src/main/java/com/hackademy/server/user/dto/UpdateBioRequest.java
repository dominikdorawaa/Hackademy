package com.hackademy.server.user.dto;

import jakarta.validation.constraints.Size;

public record UpdateBioRequest(
    @Size(max = 500, message = "Bio nie może przekraczać 500 znaków") String bio
) {}
