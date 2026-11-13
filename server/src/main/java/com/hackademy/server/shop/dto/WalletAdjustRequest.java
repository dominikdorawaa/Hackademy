package com.hackademy.server.shop.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record WalletAdjustRequest(
        @NotNull(message = "Podaj liczbę Bajtów.") @Min(value = -1_000_000, message = "Za duża kwota.") @Max(value = 1_000_000, message = "Za duża kwota.") Long amount,
        @NotBlank(message = "Podaj powód.") @Size(max = 200, message = "Powód może mieć najwyżej 200 znaków.") String reason) {}
