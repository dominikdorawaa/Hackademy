package com.hackademy.server.user.dto;

import com.hackademy.server.badge.BadgeDto;
import com.hackademy.server.user.Role;
import lombok.Builder;
import java.time.LocalDateTime;
import java.util.List;

@Builder
public record UserProfileDto(
    String username,
    int points,
    Role role,
    LocalDateTime createdAt,
    int streak,
    String bio,
    List<BadgeDto> badges,
    String tagline,
    String avatarSeed,
    List<String> interests,
    List<Long> featuredBadgeIds
) {}
