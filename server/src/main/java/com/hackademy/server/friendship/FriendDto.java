package com.hackademy.server.friendship;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.hackademy.server.user.dto.UserAvatarDto;

import java.time.LocalDateTime;
import java.time.ZoneId;

public record FriendDto(
    Long id,
    String username,
    int points,
    int streak,
    UserAvatarDto avatar,
    boolean online,
    int winsAgainst,
    int lossesAgainst,
    String activity,
    String activityRoom,
    Long lastSeenAt,
    @JsonIgnore boolean sharesActivity
) {
    public FriendDto(Long id, String username, int points, int streak, UserAvatarDto avatar, boolean online, int winsAgainst, int lossesAgainst) {
        this(id, username, points, streak, avatar, online, winsAgainst, lossesAgainst, null, null, null, true);
    }

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
        return new FriendDto(id, username, points, streak, avatar, online, winsAgainst, lossesAgainst, activity, activityRoom, lastSeenAt, sharesActivity);
    }

    public static Long epochMillis(LocalDateTime at) {
        return at == null ? null : at.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
    }

    public FriendDto withSharing(boolean shares, LocalDateTime seenAt) {
        return new FriendDto(id, username, points, streak, avatar, online, winsAgainst, lossesAgainst, activity, activityRoom, epochMillis(seenAt), shares);
    }

    public FriendDto withActivity(boolean online, String activity, String activityRoom, Long lastSeenAt) {
        return new FriendDto(id, username, points, streak, avatar, online, winsAgainst, lossesAgainst, activity, activityRoom, lastSeenAt, sharesActivity);
    }
}
