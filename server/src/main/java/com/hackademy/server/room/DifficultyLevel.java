package com.hackademy.server.room;

public enum DifficultyLevel {
    EASY(50),
    MEDIUM(100),
    HARD(150),
    INSANE(200);

    private final int suggestedPoints;

    DifficultyLevel(int suggestedPoints) {
        this.suggestedPoints = suggestedPoints;
    }

    public int suggestedPoints() {
        return suggestedPoints;
    }
}
