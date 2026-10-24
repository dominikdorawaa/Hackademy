package com.hackademy.server.arena;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import java.util.stream.LongStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class QuestionDrawTest {
    private static final List<String> LEVELS = ArenaQuestionRules.DIFFICULTIES;

    private static List<QuestionLevel> bank(int perLevel) {
        List<QuestionLevel> bank = new ArrayList<>();
        for (int level = 0; level < LEVELS.size(); level++) {
            int offset = level * 1_000;
            String difficulty = LEVELS.get(level);
            LongStream.range(0, perLevel).forEach(index -> bank.add(new QuestionLevel(offset + index, difficulty)));
        }
        return bank;
    }

    private static int levelOf(long id) {
        return (int) (id / 1_000);
    }

    private static int[] shares(int elo) {
        var random = new Random(242);
        var bank = bank(100);
        int[] counts = new int[LEVELS.size()];
        for (int match = 0; match < 2_000; match++) {
            QuestionDraw.pick(bank, elo, 1, random).forEach(id -> counts[levelOf(id)]++);
        }
        return counts;
    }

    @ParameterizedTest
    @CsvSource({"0,0", "399,0", "400,1", "500,1", "649,1", "650,2", "899,2", "900,3", "1149,3", "1150,4", "3000,4"})
    void mapsEloToATargetLevel(int elo, int level) {
        assertEquals(level, QuestionDraw.targetLevel(elo));
    }

    @Test
    void averagesBothPlayersAndFallsBackToTheStartingElo() {
        assertEquals(750, QuestionDraw.averageElo(300, 1200));
        assertEquals(751, QuestionDraw.averageElo(301, 1200));
        assertEquals(400, QuestionDraw.averageElo(null, 300));
        assertEquals(500, QuestionDraw.averageElo(null, null));
    }

    @Test
    void weightsTheTargetLevelHighestAndFadesWithDistance() {
        assertArrayEquals(new int[]{50, 20, 5, 3, 2}, QuestionDraw.weights(300));
        assertArrayEquals(new int[]{5, 20, 50, 20, 5}, QuestionDraw.weights(800));
        assertArrayEquals(new int[]{2, 3, 5, 20, 50}, QuestionDraw.weights(1200));
    }

    @Test
    void lowEloMostlyGetsVeryEasyQuestionsAndHighEloVeryHardOnes() {
        int[] low = shares(300);
        assertTrue(low[0] > 1_150 && low[0] < 1_350, () -> Arrays.toString(low));
        assertTrue(low[0] > 2 * low[1] && low[1] > low[2] && low[4] < 100, () -> Arrays.toString(low));

        int[] high = shares(1200);
        assertTrue(high[4] > 1_150 && high[4] < 1_350, () -> Arrays.toString(high));
        assertTrue(high[4] > 2 * high[3] && high[3] > high[2] && high[0] < 100, () -> Arrays.toString(high));

        int[] middle = shares(800);
        assertTrue(middle[2] > 900 && middle[2] < 1_100, () -> Arrays.toString(middle));
        assertTrue(middle[1] > 300 && middle[3] > 300, () -> Arrays.toString(middle));
    }

    @Test
    void neverRepeatsAQuestionAndStopsWhenTheBankRunsOut() {
        var random = new Random(7);
        var bank = bank(2);
        var picked = QuestionDraw.pick(bank, 300, 10, random);
        assertEquals(10, picked.size());
        assertEquals(10, new HashSet<>(picked).size());
        assertEquals(10, QuestionDraw.pick(bank, 1200, 25, random).size());
        assertEquals(List.of(), QuestionDraw.pick(List.of(), 500, 10, random));
    }

    @Test
    void fillsAnEmptyLevelFromTheNearestOneAndIgnoresUnknownLevels() {
        var random = new Random(11);
        var bank = List.of(new QuestionLevel(1L, "EASY"), new QuestionLevel(2L, "EASY"), new QuestionLevel(3L, "VERY_HARD"),
                new QuestionLevel(4L, "INSANE"));
        int easy = 0;
        for (int draw = 0; draw < 400; draw++) {
            long first = QuestionDraw.pick(bank, 0, 1, random).get(0);
            assertTrue(first == 1L || first == 2L || first == 3L);
            if (first != 3L) easy++;
        }
        assertTrue(easy > 360, String.valueOf(easy));
        var everything = QuestionDraw.pick(bank, 1200, 10, random);
        assertEquals(Set.of(1L, 2L, 3L), new HashSet<>(everything));
        int veryHard = 0;
        for (int draw = 0; draw < 400; draw++) {
            if (QuestionDraw.pick(bank, 1200, 1, random).get(0) == 3L) veryHard++;
        }
        assertTrue(veryHard > 320 && veryHard < 380, String.valueOf(veryHard));
    }

    @Test
    void choosesEitherSideWhenTwoLevelsAreEquallyClose() {
        var bank = List.of(new QuestionLevel(1L, "EASY"), new QuestionLevel(2L, "HARD"));
        var random = new Random(3);
        var seen = new HashSet<Long>();
        for (int draw = 0; draw < 200; draw++) seen.addAll(QuestionDraw.pick(bank, 800, 1, random));
        assertEquals(Set.of(1L, 2L), seen);
    }

    @Test
    void theRepositoryKeepsTheDrawOrderAndSkipsQuestionsDeletedMeanwhile() {
        var repository = mock(ArenaQuestionRepository.class, CALLS_REAL_METHODS);
        doReturn(List.of(new QuestionLevel(1L, "EASY"), new QuestionLevel(2L, "EASY"), new QuestionLevel(3L, "EASY")))
                .when(repository).findLevels();
        var stored = Map.of(1L, BattleEngineTest.questions(3).get(0), 3L, BattleEngineTest.questions(3).get(2));
        doAnswer(call -> {
            Iterable<Long> ids = call.getArgument(0);
            List<ArenaQuestion> found = new ArrayList<>();
            ids.forEach(id -> Optional.ofNullable(stored.get(id)).ifPresent(found::add));
            Collections.reverse(found);
            return found;
        }).when(repository).findAllById(any());
        var random = new Random(5);
        var expected = QuestionDraw.pick(repository.findLevels(), 500, 3, new Random(5)).stream().filter(stored::containsKey).toList();
        var drawn = repository.drawForElo(500, 3, random);
        assertEquals(expected, drawn.stream().map(ArenaQuestion::getId).toList());
        assertEquals(2, drawn.size());
    }
}
