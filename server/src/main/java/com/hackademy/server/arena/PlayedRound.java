package com.hackademy.server.arena;

import java.util.Map;

record PlayedRound(int round, QuestionSnapshot question, Map<Long, Integer> choices, Map<Long, Long> answerMillis,
                   Map<Long, Integer> hpAfter) {

    Integer choiceOf(Long player) {
        Integer choice = choices.get(player);
        return choice == null || choice == BattleEngine.NO_ANSWER ? null : choice;
    }

    Integer millisOf(Long player) {
        Long millis = answerMillis.get(player);
        return choiceOf(player) == null || millis == null ? null : (int) Math.min(Integer.MAX_VALUE, millis);
    }
}
