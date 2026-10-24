package com.hackademy.server.arena;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;

class QuestionSnapshotTest {
    private static final ArenaQuestion QUESTION = new ArenaQuestion(5L, "Czym jest podatność zero-day?",
            "Nieznana producentowi", "Naprawiona", "Tylko stara", "Niewykorzystywalna", "OGOLNE", "MEDIUM", 3L);

    @Test
    void placesTheCorrectAnswerEvenlyAcrossAllPositions() {
        var random = new Random(243);
        int[] positions = new int[BattleEngine.ANSWERS];
        for (int draw = 0; draw < 4_000; draw++) {
            var snapshot = QuestionSnapshot.shuffled(QUESTION, random);
            assertEquals("Nieznana producentowi", snapshot.answers().get(snapshot.correctAnswer()));
            assertEquals(Set.of("Nieznana producentowi", "Naprawiona", "Tylko stara", "Niewykorzystywalna"),
                    Set.copyOf(snapshot.answers()));
            positions[snapshot.correctAnswer()]++;
        }
        for (int count : positions) assertTrue(count > 850 && count < 1_150, () -> List.of(positions[0], positions[1], positions[2], positions[3]).toString());
    }

    @Test
    void keepsTheQuestionDetailsAndAnImmutableOrder() {
        var snapshot = QuestionSnapshot.shuffled(QUESTION, AnswerOrder.correctAt(3));
        assertEquals(new QuestionSnapshot(5L, "Czym jest podatność zero-day?", "OGOLNE",
                List.of("Naprawiona", "Tylko stara", "Niewykorzystywalna", "Nieznana producentowi"), 3), snapshot);
        assertThrows(UnsupportedOperationException.class, () -> snapshot.answers().set(0, "X"));
        assertEquals(List.of("Naprawiona", "Tylko stara", "Niewykorzystywalna"), QUESTION.wrongAnswers());
    }

    @Test
    void everyMatchDrawsItsOwnOrderAndScoresTheMovedAnswer() {
        var bank = IntStream.rangeClosed(1, 10).mapToObj(id -> new ArenaQuestion((long) id, "Pytanie " + id,
                "Dobra", "Zła 1", "Zła 2", "Zła 3", "WEB", "EASY", 0L)).toList();
        var random = new Random(42);
        var first = duel(bank, random);
        var second = duel(bank, random);
        var firstOrder = first.getQuestions().stream().map(QuestionSnapshot::correctAnswer).toList();
        var secondOrder = second.getQuestions().stream().map(QuestionSnapshot::correctAnswer).toList();
        assertNotEquals(firstOrder, secondOrder);
        assertTrue(Set.copyOf(firstOrder).size() > 1);

        int correct = first.getQuestions().get(0).correctAnswer();
        assertEquals(first.getQuestions().get(0).answers(), first.getQuestion().answers());
        BattleEngine.answer(first, 1L, 1, correct, 1_000);
        BattleEngine.answer(first, 2L, 1, (correct + 1) % BattleEngine.ANSWERS, 1_000);
        BattleEngine.resolve(first, 1_000);
        assertEquals(correct, first.getLastRound().correctAnswer());
        assertEquals("Dobra", first.getLastRound().answers().get(correct));
        assertEquals(first.getQuestions().get(0).answers(), first.getLastRound().answers());
        assertEquals(100, first.getHp().get(1L));
        assertEquals(81, first.getHp().get(2L));
    }

    private static GameSession duel(List<ArenaQuestion> bank, Random random) {
        var session = new GameSession();
        session.setPlayer1Id(1L);
        session.setPlayer2Id(2L);
        BattleEngine.start(session, bank, 0, random);
        return session;
    }
}
