package com.hackademy.server.user.dto;

import jakarta.validation.constraints.NotBlank;

public record ChangePasswordRequest(
    @NotBlank(message = "Obecne haslo jest wymagane") String currentPassword,
    @NotBlank(message = "Nowe haslo jest wymagane") String newPassword
) {}
