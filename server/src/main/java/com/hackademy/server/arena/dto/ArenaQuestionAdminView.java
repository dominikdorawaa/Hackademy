package com.hackademy.server.arena.dto;

import com.hackademy.server.arena.ArenaQuestion;

import java.util.List;

public record ArenaQuestionAdminView(Long id, String content, String correctAnswer, List<String> wrongAnswers,
                                     String category, String difficulty, long version) {

    public static ArenaQuestionAdminView of(ArenaQuestion question) {
        return new ArenaQuestionAdminView(question.getId(), question.getContent(), question.getCorrectAnswer(),
                question.wrongAnswers(), question.getCategory(), question.getDifficulty(), question.getVersion());
    }
}
