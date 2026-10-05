package com.hackademy.server.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateUsernameRequest(
    @NotBlank(message = "Nazwa użytkownika jest wymagana") @Size(min = 3, max = 20, message = "Nazwa użytkownika musi mieć od 3 do 20 znaków") String newUsername
) {}
