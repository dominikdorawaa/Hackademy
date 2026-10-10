package com.hackademy.server.user.dto;

public record ProfileStatsDto(long solvedRooms, long unlockedHints, long earnedBadges, int arenaRating, long completedPaths) {
}
