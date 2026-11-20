package com.hackademy.server.arena.dto;

import java.util.List;

public record ArenaMatchRoundView(int round, String content, String category, String difficulty, List<String> answers,
                                  int correctAnswer, Integer choice, Integer answerMillis, Integer opponentChoice,
                                  Integer opponentAnswerMillis, int hpAfter, int opponentHpAfter) {
}
