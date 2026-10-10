package com.hackademy.server.friendship;

import java.time.LocalDateTime;

public record FriendRequestDto(
    Long id,
    String requesterUsername,
    LocalDateTime createdAt,
    String avatarSeed
) {
    public FriendRequestDto(Long id, String username, LocalDateTime createdAt) {
        this(id, username, createdAt, username);
    }
}
