package com.hackademy.server.room;

public final class RoomScoring {

    static final int HINT_PENALTY_PERCENT = 10;
    static final int MAX_HINT_PENALTY_PERCENT = 50;

    private RoomScoring() {}

    public static int pointsAfterHints(int points, long unlockedHints) {
        long penalty = Math.min(Math.max(unlockedHints, 0) * HINT_PENALTY_PERCENT, MAX_HINT_PENALTY_PERCENT);
        return (int) (Math.max(points, 0) * (100 - penalty) / 100);
    }
}
