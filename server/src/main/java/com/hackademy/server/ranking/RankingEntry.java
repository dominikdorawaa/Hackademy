package com.hackademy.server.ranking;

public record RankingEntry(
    Integer rankPoints,
    Integer rankElo,
    String username,
    Integer points,
    Integer elo
) {}
