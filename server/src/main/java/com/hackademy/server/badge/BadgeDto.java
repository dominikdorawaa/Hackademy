package com.hackademy.server.badge;

import java.time.LocalDateTime;

public record BadgeDto(
    Long id,
    String name,
    String description,
    String icon,
    LocalDateTime earnedAt,
    boolean earned,
    double rarityPercentage,
    BadgeProgressDto progress
) {
    public BadgeDto(Long id, String name, String description, String icon,
                    LocalDateTime earnedAt, boolean earned, double rarityPercentage) {
        this(id, name, description, icon, earnedAt, earned, rarityPercentage, null);
    }
}
