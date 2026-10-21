package com.hackademy.server.arena;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.Arguments;

import java.util.List;
import java.util.Map;
import java.util.stream.LongStream;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import static com.hackademy.server.arena.BattleEngine.AnswerResult.*;
import static org.junit.jupiter.api.Assertions.*;

class BattleEngineTest {
    private GameSession session;

    static List<ArenaQuestion> questions(int count) {
        return LongStream.rangeClosed(1, count).mapToObj(id -> new ArenaQuestion(id, "Pytanie " + id,
                "A", "B", "C", "D", 2, "SIECI", "MEDIUM")).toList();
    }

    @BeforeEach
    void start() {
        session = new GameSession();
        session.setPlayer1Id(1L);
        session.setPlayer2Id(2L);
        BattleEngine.start(session, questions(12), 1_000);
    }

    @Test
    void startsTheFirstRoundWithFullHealthAndHiddenAnswer() {
        assertEquals("ACTIVE", session.getStatus());
        assertEquals("QUESTION", session.getPhase());
        assertEquals(1, session.getRound());
        assertEquals(10, session.getTotalRounds());
        assertEquals(1_000 + BattleEngine.ROUND_MILLIS, session.getRoundEndsAt());
        assertEquals(Map.of(1L, 100, 2L, 100), session.getHp());
        assertEquals(new BattleQuestion(1L, "Pytanie 1", "SIECI", List.of("A", "B", "C", "D")), session.getQuestion());
    }

    @Test
    void refusesToStartWithoutQuestionsAndShortensMatchesWithFewQuestions() {
        var empty = new GameSession();
        empty.setPlayer1Id(1L);
        empty.setPlayer2Id(2L);
        assertThrows(IllegalStateException.class, () -> BattleEngine.start(empty, List.of(), 0));
        BattleEngine.start(empty, questions(3), 0);
        assertEquals(3, empty.getTotalRounds());
    }

    @Test
    void rejectsAnswersForOtherRoundsWithoutConsumingTheCurrentAnswer() {
        BattleEngine.resolve(session, session.getRoundEndsAt());
        BattleEngine.nextRound(session, 20_000);
        assertEquals(WRONG_ROUND, BattleEngine.answer(session, 1L, 1, 2, 20_001));
        assertEquals(WRONG_ROUND, BattleEngine.answer(session, 1L, 3, 2, 20_001));
        assertEquals(WRONG_ROUND, BattleEngine.answer(session, 1L, 0, 2, 20_001));
        assertTrue(session.getChoices().isEmpty());
        assertTrue(session.getAnsweredBy().isEmpty());
        assertEquals(Map.of(1L, 100, 2L, 100), session.getHp());
        assertEquals(ACCEPTED, BattleEngine.answer(session, 1L, 2, 0, 20_001));
        assertEquals(ACCEPTED, BattleEngine.answer(session, 2L, 2, 0, 20_001));
        BattleEngine.resolve(session, 20_001);
        assertEquals(Map.of(1L, 100, 2L, 100), session.getHp());
        assertEquals(Map.of(1L, 0, 2L, 0), session.getLastRound().choices());
    }

    @Test
    void validatesEveryAnswer() {
        assertEquals(NOT_PLAYER, BattleEngine.answer(session, 3L, session.getRound(), 2, 2_000));
        assertEquals(INVALID_ANSWER, BattleEngine.answer(session, 1L, session.getRound(), -1, 2_000));
        assertEquals(INVALID_ANSWER, BattleEngine.answer(session, 1L, session.getRound(), 4, 2_000));
        assertEquals(TOO_LATE, BattleEngine.answer(session, 1L, session.getRound(), 2, session.getRoundEndsAt() + 1));
        assertEquals(ACCEPTED, BattleEngine.answer(session, 1L, session.getRound(), 0, 2_000));
        assertEquals(ALREADY_ANSWERED, BattleEngine.answer(session, 1L, session.getRound(), 2, 2_000));
        assertEquals(List.of(1L), session.getAnsweredBy());
        assertFalse(BattleEngine.roundOver(session, 2_000));
        assertTrue(BattleEngine.roundOver(session, session.getRoundEndsAt()));
    }

    @Test
    void aCorrectAnswerHitsTheRivalAccordingToItsAcceptedTime() {
        BattleEngine.answer(session, 2L, session.getRound(), 1, 1_100);
        BattleEngine.answer(session, 1L, session.getRound(), 2, 9_000);
        assertTrue(BattleEngine.roundOver(session, 9_000));
        assertFalse(BattleEngine.resolve(session, 9_000));
        assertEquals(Map.of(1L, 100, 2L, 88), session.getHp());
        var result = session.getLastRound();
        assertEquals(1, result.round());
        assertEquals(2, result.correctAnswer());
        assertEquals(Map.of(1L, 2, 2L, 1), result.choices());
        assertEquals(Map.of(1L, 0, 2L, 12), result.damage());
        assertEquals("REVEAL", session.getPhase());
        assertNull(session.getQuestion());
        assertEquals(NOT_ACTIVE, BattleEngine.answer(session, 1L, session.getRound(), 2, 9_100));
    }

    @Test
    void bothCorrectAnswersHurtBothPlayersAndMissingAnswersDealNothing() {
        BattleEngine.answer(session, 1L, session.getRound(), 2, 2_000);
        BattleEngine.answer(session, 2L, session.getRound(), 2, 2_000);
        BattleEngine.resolve(session, 2_000);
        assertEquals(Map.of(1L, 81, 2L, 81), session.getHp());
        BattleEngine.nextRound(session, 5_000);
        BattleEngine.resolve(session, session.getRoundEndsAt());
        assertEquals(Map.of(1L, BattleEngine.NO_ANSWER, 2L, BattleEngine.NO_ANSWER), session.getLastRound().choices());
        assertEquals(Map.of(1L, 81, 2L, 81), session.getHp());
    }

    @Test
    void waitsForTheRevealBeforeTheNextRound() {
        BattleEngine.resolve(session, 3_000);
        assertFalse(BattleEngine.nextRoundDue(session, 3_000 + BattleEngine.REVEAL_MILLIS - 1));
        assertTrue(BattleEngine.nextRoundDue(session, 3_000 + BattleEngine.REVEAL_MILLIS));
        BattleEngine.nextRound(session, 6_000);
        assertEquals(2, session.getRound());
        assertEquals("QUESTION", session.getPhase());
        assertTrue(session.getAnsweredBy().isEmpty());
        assertEquals("Pytanie 2", session.getQuestion().content());
    }

    @Test
    void fiveHitsKnockOutTheRival() {
        boolean finished = false;
        long now = 1_000;
        for (int round = 1; round <= 5; round++) {
            BattleEngine.answer(session, 1L, session.getRound(), 2, now + 100);
            finished = BattleEngine.resolve(session, now + 100);
            now += 3_100;
            if (!finished) BattleEngine.nextRound(session, now);
        }
        assertTrue(finished);
        assertEquals(0, session.getHp().get(2L));
        assertEquals(1L, BattleEngine.leader(session));
        assertEquals("KNOCKOUT", BattleEngine.finishReason(session));
    }

    @Test
    void afterTheLastRoundTheHealthierPlayerWinsAndEqualHealthIsADraw() {
        for (int round = 1; round <= 10; round++) {
            boolean finished = BattleEngine.resolve(session, 1_000L * round);
            assertEquals(round == 10, finished);
            if (!finished) BattleEngine.nextRound(session, 1_000L * round);
        }
        assertNull(BattleEngine.leader(session));
        assertEquals("ROUNDS", BattleEngine.finishReason(session));
        session.getHp().put(1L, 60);
        assertEquals(2L, BattleEngine.leader(session));
    }

    static Stream<Arguments> damageBoundaries() {
        return IntStream.rangeClosed(1, 15).boxed().flatMap(second -> Stream.of(
                Arguments.of(second * 1_000L - 1, 21 - second),
                Arguments.of(second * 1_000L, 20 - second)));
    }

    @ParameterizedTest
    @MethodSource("damageBoundaries")
    void damageChangesAtEveryFullSecondIncludingTheExistingDeadline(long elapsed, int expected) {
        assertEquals(ACCEPTED, BattleEngine.answer(session, 1L, 1, 2, 1_000 + elapsed));
        BattleEngine.resolve(session, 50_000);
        assertEquals(expected, session.getLastRound().damage().get(2L));
        assertEquals(100 - expected, session.getHp().get(2L));
    }

    @Test
    void duplicateInvalidAndStaleAnswersCannotChangeTheFirstAcceptedTime() {
        assertEquals(INVALID_ANSWER, BattleEngine.answer(session, 1L, 1, 4, 1_100));
        assertTrue(session.getAnswerElapsedMillis().isEmpty());
        assertEquals(ACCEPTED, BattleEngine.answer(session, 1L, 1, 2, 3_999));
        assertEquals(ALREADY_ANSWERED, BattleEngine.answer(session, 1L, 1, 0, 4_000));
        assertEquals(WRONG_ROUND, BattleEngine.answer(session, 1L, 2, 2, 4_001));
        assertEquals(2_999L, session.getAnswerElapsedMillis().get(1L));
        BattleEngine.resolve(session, 16_000);
        assertEquals(18, session.getLastRound().damage().get(2L));
        BattleEngine.nextRound(session, 19_000);
        assertTrue(session.getAnswerElapsedMillis().isEmpty());
        assertEquals(WRONG_ROUND, BattleEngine.answer(session, 1L, 1, 2, 19_001));
        assertTrue(session.getAnswerElapsedMillis().isEmpty());
    }

    @Test
    void lateAndIncorrectAnswersDealNoDamage() {
        assertEquals(TOO_LATE, BattleEngine.answer(session, 1L, 1, 2, 16_001));
        assertTrue(session.getAnswerElapsedMillis().isEmpty());
        assertEquals(ACCEPTED, BattleEngine.answer(session, 2L, 1, 0, 15_999));
        BattleEngine.resolve(session, 16_001);
        assertEquals(Map.of(1L, 0, 2L, 0), session.getLastRound().damage());
        assertEquals(Map.of(1L, 100, 2L, 100), session.getHp());
    }

    @Test
    void deadlineExtensionsExcludePausedTimeWithoutChangingAnEarlierAnswer() {
        assertEquals(ACCEPTED, BattleEngine.answer(session, 1L, 1, 2, 1_499));
        session.setPhase("PAUSED");
        assertEquals(NOT_ACTIVE, BattleEngine.answer(session, 2L, 1, 2, 3_000));
        session.setPhase("QUESTION");
        session.setRoundEndsAt(session.getRoundEndsAt() + 5_000);
        assertEquals(ACCEPTED, BattleEngine.answer(session, 2L, 1, 2, 7_000));
        BattleEngine.resolve(session, 21_000);
        assertEquals(Map.of(1L, 19, 2L, 20), session.getLastRound().damage());
        assertEquals(Map.of(1L, 81, 2L, 80), session.getHp());
    }

    @Test
    void simultaneousKnockoutReportsOnlyTheRemainingHpAndRemainsADraw() {
        session.getHp().put(1L, 3);
        session.getHp().put(2L, 7);
        BattleEngine.answer(session, 1L, 1, 2, 1_001);
        BattleEngine.answer(session, 2L, 1, 2, 1_999);
        assertTrue(BattleEngine.resolve(session, 1_999));
        assertEquals(Map.of(1L, 3, 2L, 7), session.getLastRound().damage());
        assertEquals(Map.of(1L, 0, 2L, 0), session.getHp());
        assertNull(BattleEngine.leader(session));
        assertEquals("KNOCKOUT", BattleEngine.finishReason(session));
    }
}
