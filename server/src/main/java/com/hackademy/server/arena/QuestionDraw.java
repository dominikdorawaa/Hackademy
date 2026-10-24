package com.hackademy.server.arena;

import java.util.ArrayList;
import java.util.List;
import java.util.random.RandomGenerator;

public final class QuestionDraw {
    static final int DEFAULT_ELO = 500;
    static final int[] LEVEL_THRESHOLDS = {400, 650, 900, 1150};
    static final int[] DISTANCE_WEIGHTS = {50, 20, 5, 3, 2};

    private QuestionDraw() {}

    public static int averageElo(Integer first, Integer second) {
        int sum = (first == null ? DEFAULT_ELO : first) + (second == null ? DEFAULT_ELO : second);
        return Math.round(sum / 2.0f);
    }

    static int targetLevel(int elo) {
        int level = 0;
        for (int threshold : LEVEL_THRESHOLDS) {
            if (elo >= threshold) level++;
        }
        return level;
    }

    static int[] weights(int elo) {
        int target = targetLevel(elo);
        int[] weights = new int[ArenaQuestionRules.DIFFICULTIES.size()];
        for (int level = 0; level < weights.length; level++) weights[level] = DISTANCE_WEIGHTS[Math.abs(level - target)];
        return weights;
    }

    public static List<Long> pick(List<QuestionLevel> bank, int elo, int count, RandomGenerator random) {
        List<List<Long>> pools = new ArrayList<>();
        ArenaQuestionRules.DIFFICULTIES.forEach(level -> pools.add(new ArrayList<>()));
        for (QuestionLevel question : bank) {
            int level = ArenaQuestionRules.DIFFICULTIES.indexOf(question.difficulty());
            if (level >= 0) pools.get(level).add(question.id());
        }
        int[] weights = weights(elo);
        List<Long> picked = new ArrayList<>();
        while (picked.size() < count) {
            int level = nearestWithQuestions(pools, roll(weights, random), random);
            if (level < 0) break;
            List<Long> pool = pools.get(level);
            picked.add(pool.remove(random.nextInt(pool.size())));
        }
        return picked;
    }

    private static int roll(int[] weights, RandomGenerator random) {
        int total = 0;
        for (int weight : weights) total += weight;
        int value = random.nextInt(total);
        for (int level = 0; level < weights.length; level++) {
            value -= weights[level];
            if (value < 0) return level;
        }
        return weights.length - 1;
    }

    private static int nearestWithQuestions(List<List<Long>> pools, int level, RandomGenerator random) {
        for (int distance = 0; distance < pools.size(); distance++) {
            boolean lower = level - distance >= 0 && !pools.get(level - distance).isEmpty();
            boolean higher = distance > 0 && level + distance < pools.size() && !pools.get(level + distance).isEmpty();
            if (lower && higher) return random.nextBoolean() ? level - distance : level + distance;
            if (lower) return level - distance;
            if (higher) return level + distance;
        }
        return -1;
    }
}
