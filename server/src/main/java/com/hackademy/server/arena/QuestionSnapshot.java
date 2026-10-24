package com.hackademy.server.arena;

import java.util.List;

/** The copy of a bank question a duel plays with, so later edits or deletions do not reach a started match. */
public record QuestionSnapshot(Long id, String content, String category, List<String> answers, int correctAnswer) {

    static QuestionSnapshot of(ArenaQuestion question) {
        return new QuestionSnapshot(question.getId(), question.getContent(), question.getCategory(),
                List.copyOf(question.answers()), question.getCorrectAnswer());
    }
}
