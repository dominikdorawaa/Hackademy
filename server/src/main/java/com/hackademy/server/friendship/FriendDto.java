package com.hackademy.server.friendship;

public record FriendDto(
    Long id,
    String username,
    int points,
    int streak,
    String avatarSeed
) {
    public FriendDto(Long id, String username, int points, int streak) {
        this(id, username, points, streak, username);
    }
}
