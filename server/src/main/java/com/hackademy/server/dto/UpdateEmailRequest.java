package com.hackademy.server.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateEmailRequest {

    @NotBlank(message = "Nowy adres email jest wymagany")
    @Email(message = "Podaj poprawny adres email")
    private String newEmail;

    @NotBlank(message = "Hasło jest wymagane do potwierdzenia")
    private String password;
}
