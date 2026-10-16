package com.hackademy.server.arena;

import java.util.List;

public record BattleQuestion(Long id, String content, String category, List<String> answers) {

    static BattleQuestion of(ArenaQuestion question) {
        return new BattleQuestion(question.getId(), question.getContent(), question.getCategory(), question.answers());
    }
}
