package com.hackademy.server.friendship;

import com.hackademy.server.user.dto.UserAvatarDto;

public record FriendDto(
    Long id,
    String username,
    int points,
    int streak,
    UserAvatarDto avatar,
    boolean online,
    int winsAgainst,
    int lossesAgainst
) {
    public FriendDto(Long id, String username, int points, int streak, UserAvatarDto avatar) {
        this(id, username, points, streak, avatar, false, 0, 0);
    }

    public FriendDto(Long id, String username, int points, int streak) {
        this(id, username, points, streak, null, false, 0, 0);
    }

    public FriendDto(Long id, String username, int points, int streak, UserAvatarDto avatar, boolean online) {
        this(id, username, points, streak, avatar, online, 0, 0);
    }

    public FriendDto withOnline(boolean online) {
        return new FriendDto(id, username, points, streak, avatar, online, winsAgainst, lossesAgainst);
    }
}
