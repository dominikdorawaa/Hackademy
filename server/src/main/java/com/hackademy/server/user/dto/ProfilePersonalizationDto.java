package com.hackademy.server.user.dto;

import java.util.List;

public record ProfilePersonalizationDto(
        String bio, String tagline, String avatarSeed,
        List<String> interests, List<Long> featuredBadgeIds) {}
