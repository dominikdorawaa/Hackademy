package com.hackademy.server.arena;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class BattleEngine {
    public static final int MAX_HP = 100;
    public static final int ROUNDS = 10;
    public static final int DAMAGE = 20;
    public static final int ANSWERS = 4;
    public static final long ROUND_MILLIS = 15_000;
    public static final long REVEAL_MILLIS = 3_000;
    public static final long DISCONNECT_MILLIS = 30_000;
    public static final int NO_ANSWER = -1;

    public enum AnswerResult { ACCEPTED, NOT_PLAYER, NOT_ACTIVE, WRONG_ROUND, INVALID_ANSWER, ALREADY_ANSWERED, TOO_LATE }

    private BattleEngine() {}

    public static void start(GameSession session, List<ArenaQuestion> questions, long now) {
        if (questions.isEmpty()) throw new IllegalStateException("Brak pytań do walki.");
        session.setQuestions(List.copyOf(questions));
        session.setTotalRounds(Math.min(ROUNDS, questions.size()));
        session.getHp().put(session.getPlayer1Id(), MAX_HP);
        session.getHp().put(session.getPlayer2Id(), MAX_HP);
        session.setStatus("ACTIVE");
        openRound(session, 1, now);
    }

    public static AnswerResult answer(GameSession session, Long userId, int round, int answer, long now) {
        if (!session.includes(userId)) return AnswerResult.NOT_PLAYER;
        if (round != session.getRound()) return AnswerResult.WRONG_ROUND;
        if (!"ACTIVE".equals(session.getStatus()) || !"QUESTION".equals(session.getPhase())) return AnswerResult.NOT_ACTIVE;
        if (answer < 0 || answer >= ANSWERS) return AnswerResult.INVALID_ANSWER;
        if (session.getChoices().containsKey(userId)) return AnswerResult.ALREADY_ANSWERED;
        if (now > session.getRoundEndsAt()) return AnswerResult.TOO_LATE;
        session.getChoices().put(userId, answer);
        session.getAnsweredBy().add(userId);
        return AnswerResult.ACCEPTED;
    }

    public static boolean roundOver(GameSession session, long now) {
        return "QUESTION".equals(session.getPhase())
                && (session.getChoices().size() == 2 || now >= session.getRoundEndsAt());
    }

    public static boolean resolve(GameSession session, long now) {
        ArenaQuestion question = session.getQuestions().get(session.getRound() - 1);
        Long first = session.getPlayer1Id();
        Long second = session.getPlayer2Id();
        Map<Long, Integer> choices = new HashMap<>();
        choices.put(first, session.getChoices().getOrDefault(first, NO_ANSWER));
        choices.put(second, session.getChoices().getOrDefault(second, NO_ANSWER));
        Map<Long, Integer> damage = new HashMap<>();
        damage.put(first, choices.get(second) == question.getCorrectAnswer() ? DAMAGE : 0);
        damage.put(second, choices.get(first) == question.getCorrectAnswer() ? DAMAGE : 0);
        session.getHp().replaceAll((player, hp) -> Math.max(0, hp - damage.get(player)));
        session.setLastRound(new RoundResult(session.getRound(), question.getId(), question.getContent(),
                question.answers(), question.getCorrectAnswer(), Map.copyOf(choices), Map.copyOf(damage)));
        session.setQuestion(null);
        session.setPhase("REVEAL");
        session.setRoundEndsAt(0);
        session.setNextRoundAt(now + REVEAL_MILLIS);
        return session.getHp().get(first) == 0 || session.getHp().get(second) == 0
                || session.getRound() >= session.getTotalRounds();
    }

    public static boolean nextRoundDue(GameSession session, long now) {
        return "REVEAL".equals(session.getPhase()) && "ACTIVE".equals(session.getStatus()) && now >= session.getNextRoundAt();
    }

    public static void nextRound(GameSession session, long now) {
        openRound(session, session.getRound() + 1, now);
    }

    public static Long leader(GameSession session) {
        int first = session.getHp().get(session.getPlayer1Id());
        int second = session.getHp().get(session.getPlayer2Id());
        if (first == second) return null;
        return first > second ? session.getPlayer1Id() : session.getPlayer2Id();
    }

    public static String finishReason(GameSession session) {
        return session.getHp().containsValue(0) ? "KNOCKOUT" : "ROUNDS";
    }

    private static void openRound(GameSession session, int round, long now) {
        session.setRound(round);
        session.setPhase("QUESTION");
        session.getChoices().clear();
        session.getAnsweredBy().clear();
        session.setQuestion(BattleQuestion.of(session.getQuestions().get(round - 1)));
        session.setRoundEndsAt(now + ROUND_MILLIS);
        session.setNextRoundAt(0);
    }
}
