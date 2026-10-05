package com.hackademy.server.friendship;

public record FriendDto(
    Long id,
    String username,
    int points,
    int streak
) {}
