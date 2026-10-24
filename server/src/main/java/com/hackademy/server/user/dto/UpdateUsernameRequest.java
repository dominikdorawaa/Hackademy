package com.hackademy.server.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateUsernameRequest(
    @NotBlank(message = "Nazwa użytkownika jest wymagana")
    @Size(min = UpdateUsernameRequest.MIN, max = UpdateUsernameRequest.MAX, message = UpdateUsernameRequest.LENGTH_MESSAGE)
    @Pattern(regexp = UpdateUsernameRequest.PATTERN, message = UpdateUsernameRequest.CHARACTERS_MESSAGE) String newUsername
) {
    public static final int MIN = 3;
    public static final int MAX = 20;
    public static final String PATTERN = "[A-Za-z0-9_-]+";
    public static final String LENGTH_MESSAGE = "Nazwa użytkownika musi mieć od 3 do 20 znaków";
    public static final String CHARACTERS_MESSAGE = "Nazwa może zawierać tylko litery, cyfry, _ i -";
    public static final String TAKEN_MESSAGE = "Ta nazwa jest zajęta";
}
