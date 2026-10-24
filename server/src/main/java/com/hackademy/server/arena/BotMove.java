package com.hackademy.server.arena;

public record BotMove(int round, int answer, long at) {

    BotMove delayed(long millis) {
        return new BotMove(round, answer, at + millis);
    }
}
