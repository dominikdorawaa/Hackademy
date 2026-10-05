package com.hackademy.server.auth;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
    @NotBlank(message = "Email jest wymagany") String email,
    @NotBlank(message = "Haslo jest wymagane") String password
) {}
