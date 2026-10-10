package com.hackademy.server.ranking;

public record RankingEntry(
    Integer rankPoints,
    Integer rankElo,
    String username,
    Integer points,
    Integer elo,
    String avatarSeed
) {
    public RankingEntry(Integer rankPoints, Integer rankElo, String username, Integer points, Integer elo) {
        this(rankPoints, rankElo, username, points, elo, username);
    }
}
