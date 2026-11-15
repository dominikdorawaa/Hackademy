package com.hackademy.server.shop.dto;

import jakarta.validation.constraints.NotBlank;

public record TopUpRequest(@NotBlank(message = "Wybierz pakiet Bajtów.") String packageId) {}
