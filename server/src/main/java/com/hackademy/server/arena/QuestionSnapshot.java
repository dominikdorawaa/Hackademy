package com.hackademy.server.arena;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.random.RandomGenerator;

/** The copy of a bank question a duel plays with, so later edits or deletions do not reach a started match. */
public record QuestionSnapshot(Long id, String content, String category, String difficulty, List<String> answers,
                               int correctAnswer) {

    static QuestionSnapshot shuffled(ArenaQuestion question, RandomGenerator random) {
        List<String> answers = new ArrayList<>(BattleEngine.ANSWERS);
        answers.add(question.getCorrectAnswer());
        answers.addAll(question.wrongAnswers());
        int correct = 0;
        for (int index = answers.size() - 1; index > 0; index--) {
            int swap = random.nextInt(index + 1);
            Collections.swap(answers, index, swap);
            if (correct == index) correct = swap;
            else if (correct == swap) correct = index;
        }
        return new QuestionSnapshot(question.getId(), question.getContent(), question.getCategory(),
                question.getDifficulty(), List.copyOf(answers), correct);
    }
}
