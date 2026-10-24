package com.hackademy.server.arena;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.random.RandomGenerator;

public final class AnswerOrder {

    private AnswerOrder() {}

    public static RandomGenerator correctAt(int position) {
        List<Integer> current = new ArrayList<>(List.of(0, 1, 2, 3));
        List<Integer> target = new ArrayList<>(List.of(1, 2, 3));
        target.add(position, 0);
        int[] draws = new int[BattleEngine.ANSWERS - 1];
        for (int index = BattleEngine.ANSWERS - 1; index > 0; index--) {
            int swap = current.indexOf(target.get(index));
            draws[BattleEngine.ANSWERS - 1 - index] = swap;
            Collections.swap(current, index, swap);
        }
        AtomicInteger next = new AtomicInteger();
        return new RandomGenerator() {
            @Override
            public long nextLong() {
                throw new UnsupportedOperationException();
            }

            @Override
            public int nextInt(int bound) {
                return draws[Math.floorMod(next.getAndIncrement(), draws.length)];
            }
        };
    }
}
