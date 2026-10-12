package com.hackademy.server.user.dto;

import jakarta.validation.constraints.NotNull;

public record NotificationPreferencesDto(
        @NotNull Boolean friendRequests,
        @NotNull Boolean challenges,
        @NotNull Boolean matchFound,
        @NotNull Boolean sound,
        @NotNull Boolean browserNotifications) {
    public static NotificationPreferencesDto defaults() {
        return new NotificationPreferencesDto(true, true, true, false, false);
    }
}
