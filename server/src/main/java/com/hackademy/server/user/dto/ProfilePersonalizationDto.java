package com.hackademy.server.user.dto;

import java.util.List;

public record ProfilePersonalizationDto(
        String bio, String tagline,
        List<String> interests, List<Long> featuredBadgeIds) {}
