package com.hackademy.server.arena;

import java.util.List;

/** The question shape the battle engine plays: one correct and three wrong answers, shuffled for every duel, and the categories the database accepts. */
public final class ArenaQuestionRules {
    public static final String CATEGORY_PATTERN = "WEB|SIECI|KRYPTOGRAFIA|LINUX|OGOLNE|WINDOWS|BLUE_TEAM|CHMURA";
    public static final String DIFFICULTY_PATTERN = "VERY_EASY|EASY|MEDIUM|HARD|VERY_HARD";
    public static final List<String> CATEGORIES = List.of(CATEGORY_PATTERN.split("\\|"));
    public static final List<String> DIFFICULTIES = List.of(DIFFICULTY_PATTERN.split("\\|"));
    public static final int CONTENT_LENGTH = 500;
    public static final int ANSWER_LENGTH = 200;
    public static final int WRONG_ANSWERS = 3;

    private ArenaQuestionRules() {}
}
