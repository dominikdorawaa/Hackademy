package com.hackademy.server.arena;

import java.util.List;

public record BattleQuestion(Long id, String content, String category, String difficulty, List<String> answers) {

    static BattleQuestion of(QuestionSnapshot question) {
        return new BattleQuestion(question.id(), question.content(), question.category(), question.difficulty(),
                question.answers());
    }
}
