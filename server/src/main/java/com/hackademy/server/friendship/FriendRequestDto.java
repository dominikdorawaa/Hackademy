package com.hackademy.server.friendship;

import com.hackademy.server.user.dto.UserAvatarDto;
import java.time.LocalDateTime;

public record FriendRequestDto(
    Long id,
    String requesterUsername,
    LocalDateTime createdAt,
    String avatarSeed,
    UserAvatarDto avatar
) {
    public FriendRequestDto(Long id, String username, LocalDateTime createdAt, String avatarSeed) {
        this(id, username, createdAt, avatarSeed, null);
    }

    public FriendRequestDto(Long id, String username, LocalDateTime createdAt) {
        this(id, username, createdAt, username, null);
    }
}
