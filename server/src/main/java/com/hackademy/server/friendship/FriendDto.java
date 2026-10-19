package com.hackademy.server.friendship;

import com.hackademy.server.user.dto.UserAvatarDto;

public record FriendDto(
    Long id,
    String username,
    int points,
    int streak,
    UserAvatarDto avatar,
    boolean online
) {
    public FriendDto(Long id, String username, int points, int streak, UserAvatarDto avatar) {
        this(id, username, points, streak, avatar, false);
    }

    public FriendDto(Long id, String username, int points, int streak) {
        this(id, username, points, streak, null, false);
    }

    public FriendDto withOnline(boolean online) {
        return new FriendDto(id, username, points, streak, avatar, online);
    }
}
