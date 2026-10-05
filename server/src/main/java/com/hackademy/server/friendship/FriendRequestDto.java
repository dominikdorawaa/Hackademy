package com.hackademy.server.friendship;

import java.time.LocalDateTime;

public record FriendRequestDto(
    Long id,
    String requesterUsername,
    LocalDateTime createdAt
) {}
