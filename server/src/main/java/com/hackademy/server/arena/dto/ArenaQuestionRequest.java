package com.hackademy.server.arena.dto;

import com.hackademy.server.arena.ArenaQuestionRules;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ArenaQuestionRequest(
        @NotBlank(message = "Treść pytania jest wymagana.")
        @Size(max = ArenaQuestionRules.CONTENT_LENGTH, message = "Treść pytania może mieć najwyżej 500 znaków.")
        String content,
        @NotNull(message = "Podaj cztery odpowiedzi.")
        @Size(min = 4, max = 4, message = "Podaj cztery odpowiedzi.")
        List<@NotBlank(message = "Każda z czterech odpowiedzi jest wymagana.")
                @Size(max = ArenaQuestionRules.ANSWER_LENGTH, message = "Odpowiedź może mieć najwyżej 200 znaków.") String> answers,
        @NotNull(message = "Wskaż poprawną odpowiedź.")
        @Min(value = 0, message = "Wskaż jedną z czterech odpowiedzi.")
        @Max(value = 3, message = "Wskaż jedną z czterech odpowiedzi.")
        Integer correctAnswer,
        @NotNull(message = "Wybierz kategorię.")
        @Pattern(regexp = ArenaQuestionRules.CATEGORY_PATTERN, message = "Wybierz kategorię z listy.")
        String category,
        @NotNull(message = "Wybierz trudność.")
        @Pattern(regexp = ArenaQuestionRules.DIFFICULTY_PATTERN, message = "Wybierz trudność z listy.")
        String difficulty,
        Long version
) {}
