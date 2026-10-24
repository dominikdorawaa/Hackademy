package com.hackademy.server.arena;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.random.RandomGenerator;

public final class BattleEngine {
    public static final int MAX_HP = 100;
    public static final int ROUNDS = 10;
    public static final int DAMAGE = 20;
    public static final int ANSWERS = 4;
    public static final long ROUND_MILLIS = 15_000;
    public static final long REVEAL_MILLIS = 3_000;
    public static final long DISCONNECT_MILLIS = 30_000;
    public static final long PAUSE_MILLIS = 10_000;
    public static final int NO_ANSWER = -1;

    public enum AnswerResult { ACCEPTED, NOT_PLAYER, NOT_ACTIVE, WRONG_ROUND, INVALID_ANSWER, ALREADY_ANSWERED, TOO_LATE, PAUSED, FORFEITED }

    private BattleEngine() {}

    public static void start(GameSession session, List<ArenaQuestion> questions, long now, RandomGenerator random) {
        if (questions.isEmpty()) throw new IllegalStateException("Brak pytań do walki.");
        session.setQuestions(questions.stream().map(question -> QuestionSnapshot.shuffled(question, random)).toList());
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
        if (session.getForfeited().contains(userId)) return AnswerResult.FORFEITED;
        if (session.getPause() != null) return AnswerResult.PAUSED;
        if (answer < 0 || answer >= ANSWERS) return AnswerResult.INVALID_ANSWER;
        if (session.getChoices().containsKey(userId)) return AnswerResult.ALREADY_ANSWERED;
        if (now > session.getRoundEndsAt()) return AnswerResult.TOO_LATE;
        session.getChoices().put(userId, answer);
        session.getAnswerElapsedMillis().put(userId, Math.max(0, ROUND_MILLIS - (session.getRoundEndsAt() - now)));
        session.getAnsweredBy().add(userId);
        return AnswerResult.ACCEPTED;
    }

    public static boolean roundOver(GameSession session, long now) {
        return "QUESTION".equals(session.getPhase()) && session.getPause() == null
                && (session.getChoices().size() == 2 || now >= session.getRoundEndsAt());
    }

    public static boolean resolve(GameSession session, long now) {
        QuestionSnapshot question = session.getQuestions().get(session.getRound() - 1);
        Long first = session.getPlayer1Id();
        Long second = session.getPlayer2Id();
        Map<Long, Integer> choices = new HashMap<>();
        choices.put(first, session.getChoices().getOrDefault(first, NO_ANSWER));
        choices.put(second, session.getChoices().getOrDefault(second, NO_ANSWER));
        Map<Long, Integer> damage = new HashMap<>();
        damage.put(first, damage(session, second, first, choices.get(second) == question.correctAnswer()));
        damage.put(second, damage(session, first, second, choices.get(first) == question.correctAnswer()));
        session.getHp().replaceAll((player, hp) -> Math.max(0, hp - damage.get(player)));
        session.setLastRound(new RoundResult(session.getRound(), question.id(), question.content(),
                question.answers(), question.correctAnswer(), Map.copyOf(choices), Map.copyOf(damage)));
        session.setQuestion(null);
        session.setPhase("REVEAL");
        session.setRoundEndsAt(0);
        session.setNextRoundAt(now + REVEAL_MILLIS);
        return session.getHp().get(first) == 0 || session.getHp().get(second) == 0
                || session.getRound() >= session.getTotalRounds();
    }

    public static boolean nextRoundDue(GameSession session, long now) {
        return "REVEAL".equals(session.getPhase()) && "ACTIVE".equals(session.getStatus()) && session.getPause() == null
                && now >= session.getNextRoundAt();
    }

    public static void nextRound(GameSession session, long now) {
        openRound(session, session.getRound() + 1, now);
    }

    public static void pause(GameSession session, List<Long> players, long now) {
        session.getPausesUsed().addAll(players);
        session.setPause(new ArenaPause(List.copyOf(players), now, now + PAUSE_MILLIS));
    }

    public static void resume(GameSession session, long now) {
        ArenaPause pause = session.getPause();
        long shift = Math.min(now, pause.endsAt()) - pause.startedAt();
        if ("QUESTION".equals(session.getPhase())) session.setRoundEndsAt(session.getRoundEndsAt() + shift);
        else session.setNextRoundAt(session.getNextRoundAt() + shift);
        session.setPause(null);
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

    private static int damage(GameSession session, Long attacker, Long target, boolean correct) {
        Long elapsed = session.getAnswerElapsedMillis().get(attacker);
        if (!correct || elapsed == null) return 0;
        int strength = Math.max(0, DAMAGE - (int) (elapsed / 1_000));
        return Math.min(session.getHp().get(target), strength);
    }

    private static void openRound(GameSession session, int round, long now) {
        session.setRound(round);
        session.setPhase("QUESTION");
        session.getChoices().clear();
        session.getAnswerElapsedMillis().clear();
        session.getAnsweredBy().clear();
        session.setQuestion(BattleQuestion.of(session.getQuestions().get(round - 1)));
        session.setRoundEndsAt(now + ROUND_MILLIS);
        session.setNextRoundAt(0);
    }
}
