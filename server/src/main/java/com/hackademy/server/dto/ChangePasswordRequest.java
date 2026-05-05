package com.hackademy.server.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChangePasswordRequest {
    @NotBlank(message = "Obecne haslo jest wymagane")
    private String currentPassword;

    @NotBlank(message = "Nowe haslo jest wymagane")
    private String newPassword;
}
