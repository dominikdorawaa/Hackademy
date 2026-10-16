package com.hackademy.server.arena;

import java.util.List;
import java.util.Map;

public record RoundResult(int round, Long questionId, String content, List<String> answers, int correctAnswer,
                          Map<Long, Integer> choices, Map<Long, Integer> damage) {}
