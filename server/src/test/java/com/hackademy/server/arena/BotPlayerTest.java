package com.hackademy.server.arena;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.SplittableRandom;
import java.util.random.RandomGenerator;

import static org.junit.jupiter.api.Assertions.*;

class BotPlayerTest {
    private static final double EXACT = 1e-12;

    private GameSession duel(int botElo, RandomGenerator random) {
        var session = new GameSession();
        session.setPlayer1Id(1L);
        session.setPlayer2Id(-1L);
        session.setBotId(-1L);
        session.setPlayer1Elo(500);
        session.setPlayer2Elo(botElo);
        BattleEngine.start(session, BattleEngineTest.questions(10), 1_000, random);
        return session;
    }

    @ParameterizedTest
    @CsvSource({"-50, 0.10", "0, 0.10", "500, 0.30", "1000, 0.60", "1500, 0.90", "1501, 0.90", "3000, 0.90"})
    void theBaseChanceHitsTheTicketPointsAndStaysAtNinetyPercentAbove1500(int elo, double chance) {
        assertEquals(chance, BotPlayer.baseChance(elo), EXACT);
    }

    @ParameterizedTest
    @CsvSource({"1, 0.1004", "100, 0.14", "250, 0.20", "499, 0.2996", "501, 0.3006", "750, 0.45", "999, 0.5994",
            "1001, 0.6006", "1250, 0.75", "1499, 0.8994"})
    void theBaseChanceChangesLinearlyBetweenThePoints(int elo, double chance) {
        assertEquals(chance, BotPlayer.baseChance(elo), EXACT);
    }

    @Test
    void everyEloPointMovesTheBaseChanceAndThereAreNoSteps() {
        for (int elo = 1; elo <= 1500; elo++) {
            double step = BotPlayer.baseChance(elo) - BotPlayer.baseChance(elo - 1);
            double expected = elo <= 500 ? 0.0004 : 0.0006;
            assertEquals(expected, step, EXACT, "Elo " + elo);
        }
        assertEquals(0.0, BotPlayer.baseChance(1501) - BotPlayer.baseChance(1500), EXACT);
    }

    @Test
    void theDeviationShiftsTheChanceByUpToTenPointsAndTheResultStaysBetweenZeroAndOne() {
        var dice = new BotDice();
        dice.deviations.addAll(List.of(-0.10, 0.10, 0.05, -0.07, -0.10, 0.10));
        assertEquals(0.20, BotPlayer.chance(500, dice), EXACT);
        assertEquals(0.40, BotPlayer.chance(500, dice), EXACT);
        assertEquals(0.65, BotPlayer.chance(1000, dice), EXACT);
        assertEquals(0.83, BotPlayer.chance(1500, dice), EXACT);
        assertEquals(0.0, BotPlayer.chance(0, dice), EXACT);
        assertEquals(1.0, BotPlayer.chance(4000, dice), EXACT);
    }

    @Test
    void theChanceIsClampedWhenTheDeviationWouldLeaveTheRange() {
        RandomGenerator extreme = new RandomGenerator() {
            private boolean positive = true;

            @Override
            public long nextLong() {
                throw new UnsupportedOperationException();
            }

            @Override
            public double nextDouble(double origin, double bound) {
                positive = !positive;
                return positive ? 0.5 : -0.5;
            }
        };
        assertEquals(0.0, BotPlayer.chance(0, extreme));
        assertEquals(1.0, BotPlayer.chance(1500, extreme));
    }

    @Test
    void botEloIsDrawnFromTheWholeRangeAroundThePlayerAndNeverBelowZero() {
        var random = new SplittableRandom(142);
        for (int playerElo : List.of(0, 40, 100, 500, 1600)) {
            Set<Integer> seen = new HashSet<>();
            for (int draw = 0; draw < 20_000; draw++) {
                int elo = BotPlayer.drawElo(playerElo, random);
                assertTrue(elo >= Math.max(0, playerElo - 100) && elo <= playerElo + 100, playerElo + " -> " + elo);
                seen.add(elo);
            }
            assertEquals(playerElo + 100 - Math.max(0, playerElo - 100) + 1, seen.size(), "every value appears for " + playerElo);
        }
    }

    @Test
    void aCorrectMoveUsesTheCorrectAnswerAndTheDrawnDelay() {
        var dice = new BotDice().move(BotDice.CORRECT, 2_000);
        var session = duel(500, dice);
        BotPlayer.plan(session, dice);
        assertEquals(new BotMove(1, 2, 1_000 + 2_000), session.getBotMove());
        session.setBotMove(null);
        dice.move(BotDice.CORRECT, 12_000);
        BotPlayer.plan(session, dice);
        assertEquals(new BotMove(1, 2, 1_000 + 12_000), session.getBotMove());
    }

    @Test
    void aWrongMovePicksOnlyFromTheWrongAnswers() {
        var dice = new BotDice();
        var session = duel(500, dice);
        Set<Integer> picked = new HashSet<>();
        for (int pick = 0; pick < 3; pick++) {
            dice.move(BotDice.WRONG, 4_000);
            dice.wrongPicks.add(pick);
            BotPlayer.plan(session, dice);
            picked.add(session.getBotMove().answer());
        }
        assertEquals(Set.of(0, 1, 3), picked);
    }

    @Test
    void theRollIsComparedWithTheChanceOfThisQuestion() {
        var dice = new BotDice();
        var session = duel(1000, dice);
        dice.deviations.add(-0.10);
        dice.rolls.add(0.4999);
        BotPlayer.plan(session, dice);
        assertEquals(2, session.getBotMove().answer());
        dice.deviations.add(-0.10);
        dice.rolls.add(0.5001);
        BotPlayer.plan(session, dice);
        assertNotEquals(2, session.getBotMove().answer());
    }

    @ParameterizedTest
    @CsvSource({"0, 0.10", "250, 0.20", "500, 0.30", "800, 0.48", "1000, 0.60", "1500, 0.90", "1700, 0.90"})
    void overManyQuestionsTheBotIsRightAsOftenAsItsBaseChance(int elo, double expected) {
        var random = new SplittableRandom(elo + 7L);
        var session = duel(elo, AnswerOrder.correctAt(2));
        int correct = 0;
        int questions = 200_000;
        Set<Integer> wrong = new HashSet<>();
        long earliest = Long.MAX_VALUE;
        long latest = Long.MIN_VALUE;
        for (int question = 0; question < questions; question++) {
            BotPlayer.plan(session, random);
            BotMove move = session.getBotMove();
            if (move.answer() == 2) correct++;
            else wrong.add(move.answer());
            earliest = Math.min(earliest, move.at() - 1_000);
            latest = Math.max(latest, move.at() - 1_000);
        }
        assertEquals(expected, (double) correct / questions, 0.005);
        assertEquals(Set.of(0, 1, 3), wrong);
        assertEquals(BotPlayer.ANSWER_MIN_MILLIS, earliest);
        assertEquals(BotPlayer.ANSWER_MAX_MILLIS, latest);
    }

    @Test
    void humanDuelsHaveNoBotMoves() {
        var session = new GameSession();
        session.setPlayer1Id(1L);
        session.setPlayer2Id(2L);
        BattleEngine.start(session, BattleEngineTest.questions(10), 0, AnswerOrder.correctAt(2));
        BotPlayer.plan(session, new SplittableRandom(1));
        assertNull(session.getBotMove());
        assertFalse(BotPlayer.act(session, 60_000));
    }

    @Test
    void theBotAnswersAtItsPlannedTimeAndNotDuringAPause() {
        var dice = new BotDice().move(BotDice.CORRECT, 6_000);
        var session = duel(500, dice);
        BotPlayer.plan(session, dice);
        assertFalse(BotPlayer.act(session, 6_999));
        BattleEngine.pause(session, List.of(1L), 6_999);
        assertFalse(BotPlayer.act(session, 7_000));
        BattleEngine.resume(session, 9_999);
        assertEquals(1_000 + 6_000 + 3_000, session.getBotMove().at());
        assertFalse(BotPlayer.act(session, 9_999));
        assertTrue(BotPlayer.act(session, 10_250));
        assertEquals(6_000, session.getAnswerElapsedMillis().get(-1L));
        assertEquals(List.of(-1L), session.getAnsweredBy());
        assertNull(session.getBotMove());
        assertFalse(BotPlayer.act(session, 11_000));
    }

    @Test
    void aMoveForAnotherRoundIsDropped() {
        var dice = new BotDice();
        var session = duel(500, dice);
        session.setBotMove(new BotMove(3, 1, 2_000));
        assertFalse(BotPlayer.act(session, 2_000));
        assertNull(session.getBotMove());
        assertTrue(session.getAnsweredBy().isEmpty());
    }
}
