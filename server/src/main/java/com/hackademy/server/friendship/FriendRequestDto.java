package com.hackademy.server.friendship;

import com.hackademy.server.user.dto.UserAvatarDto;
import java.time.LocalDateTime;

public record FriendRequestDto(
    Long id,
    String requesterUsername,
    LocalDateTime createdAt,
    UserAvatarDto avatar
) {
    public FriendRequestDto(Long id, String username, LocalDateTime createdAt) {
        this(id, username, createdAt, null);
    }
}
