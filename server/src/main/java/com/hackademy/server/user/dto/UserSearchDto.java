package com.hackademy.server.user.dto;

import lombok.Builder;

@Builder
public record UserSearchDto(
    Long id,
    String username,
    int points,
    String friendshipStatus,
    int winsAgainst,
    int lossesAgainst
) {}
