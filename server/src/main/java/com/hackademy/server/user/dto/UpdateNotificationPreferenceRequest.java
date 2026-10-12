package com.hackademy.server.user.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record UpdateNotificationPreferenceRequest(
        @NotNull @Pattern(regexp = "friendRequests|challenges|matchFound|sound|browserNotifications") String preference,
        @NotNull Boolean enabled) {}
