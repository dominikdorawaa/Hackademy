package com.hackademy.server.room;

public enum DifficultyLevel {
    EASY(50),
    MEDIUM(100),
    HARD(150),
    INSANE(200);

    private final int ctfPoints;

    DifficultyLevel(int ctfPoints) {
        this.ctfPoints = ctfPoints;
    }

    public int ctfPoints() {
        return ctfPoints;
    }
}
