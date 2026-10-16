package com.hackademy.server.friendship;

import com.hackademy.server.user.dto.UserAvatarDto;

public record FriendDto(
    Long id,
    String username,
    int points,
    int streak,
    String avatarSeed,
    UserAvatarDto avatar
) {
    public FriendDto(Long id, String username, int points, int streak, String avatarSeed) {
        this(id, username, points, streak, avatarSeed, null);
    }

    public FriendDto(Long id, String username, int points, int streak) {
        this(id, username, points, streak, username, null);
    }
}
