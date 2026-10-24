package com.hackademy.server.arena;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.random.RandomGenerator;

import static org.junit.jupiter.api.Assertions.assertEquals;

final class BotDice implements RandomGenerator {
    static final double CORRECT = 0.0;
    static final double WRONG = 0.999;

    private final RandomGenerator shuffle = AnswerOrder.correctAt(2);
    final Deque<Double> deviations = new ArrayDeque<>();
    final Deque<Double> rolls = new ArrayDeque<>();
    final Deque<Integer> wrongPicks = new ArrayDeque<>();
    final Deque<Long> delays = new ArrayDeque<>();
    long defaultDelay = 5_000;

    BotDice move(double roll, long delay) {
        rolls.add(roll);
        delays.add(delay);
        return this;
    }

    @Override
    public long nextLong() {
        throw new UnsupportedOperationException();
    }

    @Override
    public int nextInt(int bound) {
        return shuffle.nextInt(bound);
    }

    @Override
    public double nextDouble(double origin, double bound) {
        assertEquals(-BotPlayer.DEVIATION, origin);
        assertEquals(Math.nextUp(BotPlayer.DEVIATION), bound);
        return deviations.isEmpty() ? 0.0 : deviations.poll();
    }

    @Override
    public double nextDouble() {
        return rolls.isEmpty() ? CORRECT : rolls.poll();
    }

    @Override
    public int nextInt(int origin, int bound) {
        assertEquals(0, origin);
        assertEquals(BattleEngine.ANSWERS - 1, bound);
        return wrongPicks.isEmpty() ? 0 : wrongPicks.poll();
    }

    @Override
    public long nextLong(long origin, long bound) {
        assertEquals(BotPlayer.ANSWER_MIN_MILLIS, origin);
        assertEquals(BotPlayer.ANSWER_MAX_MILLIS + 1, bound);
        return delays.isEmpty() ? defaultDelay : delays.poll();
    }
}
