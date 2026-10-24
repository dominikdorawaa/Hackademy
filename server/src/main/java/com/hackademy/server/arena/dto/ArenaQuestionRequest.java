package com.hackademy.server.arena.dto;

import com.hackademy.server.arena.ArenaQuestionRules;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ArenaQuestionRequest(
        @NotBlank(message = "Treść pytania jest wymagana.")
        @Size(max = ArenaQuestionRules.CONTENT_LENGTH, message = "Treść pytania może mieć najwyżej 500 znaków.")
        String content,
        @NotBlank(message = "Poprawna odpowiedź jest wymagana.")
        @Size(max = ArenaQuestionRules.ANSWER_LENGTH, message = "Odpowiedź może mieć najwyżej 200 znaków.")
        String correctAnswer,
        @NotNull(message = "Podaj trzy błędne odpowiedzi.")
        @Size(min = ArenaQuestionRules.WRONG_ANSWERS, max = ArenaQuestionRules.WRONG_ANSWERS, message = "Podaj trzy błędne odpowiedzi.")
        List<@NotBlank(message = "Każda z trzech błędnych odpowiedzi jest wymagana.")
                @Size(max = ArenaQuestionRules.ANSWER_LENGTH, message = "Odpowiedź może mieć najwyżej 200 znaków.") String> wrongAnswers,
        @NotNull(message = "Wybierz kategorię.")
        @Pattern(regexp = ArenaQuestionRules.CATEGORY_PATTERN, message = "Wybierz kategorię z listy.")
        String category,
        @NotNull(message = "Wybierz trudność.")
        @Pattern(regexp = ArenaQuestionRules.DIFFICULTY_PATTERN, message = "Wybierz trudność z listy.")
        String difficulty,
        Long version
) {}
