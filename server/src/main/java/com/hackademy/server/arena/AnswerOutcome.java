package com.hackademy.server.arena;

public record AnswerOutcome(BattleEngine.AnswerResult result, int damage) {
    static AnswerOutcome refused(BattleEngine.AnswerResult result) {
        return new AnswerOutcome(result, 0);
    }
}
