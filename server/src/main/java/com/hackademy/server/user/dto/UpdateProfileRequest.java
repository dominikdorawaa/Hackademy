package com.hackademy.server.user.dto;

import jakarta.validation.constraints.*;
import java.util.List;

public record UpdateProfileRequest(
        @NotNull @Size(max = 500) String bio,
        @NotNull @Size(max = 100) String tagline,
        @NotBlank @Size(max = 100) String avatarSeed,
        @NotNull @Size(max = 5) List<@NotNull String> interests,
        @NotNull @Size(max = 3) List<@NotNull @Positive Long> featuredBadgeIds) {}
