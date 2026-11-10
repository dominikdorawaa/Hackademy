package com.hackademy.server.arena;

import java.util.List;

public record ArenaIntroCard(int games, int wins, int losses, int streak, List<String> recent, long rank) {
    static final int RECENT = 5;
    static final ArenaIntroCard EMPTY = new ArenaIntroCard(0, 0, 0, 0, List.of(), 0);

    static int streakOf(List<String> results) {
        int streak = 0;
        for (String result : results) {
            if (!"WIN".equals(result)) break;
            streak++;
        }
        return streak;
    }
}
