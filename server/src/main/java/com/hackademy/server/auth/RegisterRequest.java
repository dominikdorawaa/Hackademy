package com.hackademy.server.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
    @NotBlank(message = "Nazwa użytkownika jest wymagana") @Size(min = 3, max = 20, message = "Nazwa użytkownika musi mieć od 3 do 20 znaków") String username,
    @NotBlank(message = "Email jest wymagany") @Email(message = "Email musi być poprawny") String email,
    @NotBlank(message = "Hasło jest wymagane") @Size(min = 8, message = "Hasło musi mieć co najmniej 8 znaków") String password
) {}
