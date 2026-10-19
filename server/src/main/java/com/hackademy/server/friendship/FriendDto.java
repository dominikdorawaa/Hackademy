package com.hackademy.server.friendship;

import com.hackademy.server.user.dto.UserAvatarDto;

public record FriendDto(
    Long id,
    String username,
    int points,
    int streak,
    UserAvatarDto avatar
) {
    public FriendDto(Long id, String username, int points, int streak) {
        this(id, username, points, streak, null);
    }
}
