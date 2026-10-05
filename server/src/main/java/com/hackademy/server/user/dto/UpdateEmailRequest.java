package com.hackademy.server.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record UpdateEmailRequest(
    @NotBlank(message = "Nowy adres email jest wymagany") @Email(message = "Podaj poprawny adres email") String newEmail,
    @NotBlank(message = "Hasło jest wymagane do potwierdzenia") String password
) {}
