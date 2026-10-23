package com.hackademy.server.arena.dto;

import com.hackademy.server.arena.ArenaQuestion;

import java.util.List;

public record ArenaQuestionAdminView(Long id, String content, List<String> answers, int correctAnswer,
                                     String category, String difficulty, long version) {

    public static ArenaQuestionAdminView of(ArenaQuestion question) {
        return new ArenaQuestionAdminView(question.getId(), question.getContent(), question.answers(),
                question.getCorrectAnswer(), question.getCategory(), question.getDifficulty(), question.getVersion());
    }
}
