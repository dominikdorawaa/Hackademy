package com.hackademy.server.arena;

import java.util.random.RandomGenerator;

public final class BotPlayer {
    static final int[] ELO_POINTS = {0, 500, 1000, 1500};
    static final double[] CHANCES = {0.10, 0.30, 0.60, 0.90};
    static final double DEVIATION = 0.10;
    static final int ELO_SPREAD = 100;
    static final long ANSWER_MIN_MILLIS = 2_000;
    static final long ANSWER_MAX_MILLIS = 12_000;

    private BotPlayer() {}

    static int drawElo(int playerElo, RandomGenerator random) {
        return random.nextInt(Math.max(0, playerElo - ELO_SPREAD), playerElo + ELO_SPREAD + 1);
    }

    static double baseChance(int elo) {
        if (elo <= ELO_POINTS[0]) return CHANCES[0];
        for (int point = 1; point < ELO_POINTS.length; point++) {
            if (elo < ELO_POINTS[point]) {
                double progress = (double) (elo - ELO_POINTS[point - 1]) / (ELO_POINTS[point] - ELO_POINTS[point - 1]);
                return CHANCES[point - 1] + progress * (CHANCES[point] - CHANCES[point - 1]);
            }
        }
        return CHANCES[CHANCES.length - 1];
    }

    static double chance(int elo, RandomGenerator random) {
        double deviation = random.nextDouble(-DEVIATION, Math.nextUp(DEVIATION));
        return Math.min(1.0, Math.max(0.0, baseChance(elo) + deviation));
    }

    static void plan(GameSession session, RandomGenerator random) {
        Long bot = session.getBotId();
        if (bot == null || !"QUESTION".equals(session.getPhase())) return;
        QuestionSnapshot question = session.getQuestions().get(session.getRound() - 1);
        boolean correct = random.nextDouble() < chance(session.eloOf(bot), random);
        int answer = correct ? question.correctAnswer() : wrongAnswer(question.correctAnswer(), random);
        long delay = random.nextLong(ANSWER_MIN_MILLIS, ANSWER_MAX_MILLIS + 1);
        long openedAt = session.getRoundEndsAt() - BattleEngine.ROUND_MILLIS;
        session.setBotMove(new BotMove(session.getRound(), answer, openedAt + delay));
    }

    static boolean act(GameSession session, long now) {
        BotMove move = session.getBotMove();
        if (move == null || session.getPause() != null || now < move.at()) return false;
        session.setBotMove(null);
        var result = BattleEngine.answer(session, session.getBotId(), move.round(), move.answer(), move.at());
        return result == BattleEngine.AnswerResult.ACCEPTED;
    }

    private static int wrongAnswer(int correct, RandomGenerator random) {
        int pick = random.nextInt(0, BattleEngine.ANSWERS - 1);
        return pick >= correct ? pick + 1 : pick;
    }
}
