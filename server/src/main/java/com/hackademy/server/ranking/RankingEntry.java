package com.hackademy.server.ranking;

import com.hackademy.server.user.dto.UserAvatarDto;

public record RankingEntry(
    Integer rankPoints,
    Integer rankElo,
    String username,
    Integer points,
    Integer elo,
    UserAvatarDto avatar,
    boolean premium
) {
    public RankingEntry(Integer rankPoints, Integer rankElo, String username, Integer points, Integer elo) {
        this(rankPoints, rankElo, username, points, elo, null, false);
    }

    public RankingEntry(Integer rankPoints, Integer rankElo, String username, Integer points, Integer elo, UserAvatarDto avatar) {
        this(rankPoints, rankElo, username, points, elo, avatar, false);
    }
}
