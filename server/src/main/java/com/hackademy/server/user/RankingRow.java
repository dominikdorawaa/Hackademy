package com.hackademy.server.user;

public interface RankingRow {
    Long getId();
    String getUsername();
    Integer getPoints();
    Integer getElo();
    Integer getRankPoints();
    Integer getRankElo();
}
