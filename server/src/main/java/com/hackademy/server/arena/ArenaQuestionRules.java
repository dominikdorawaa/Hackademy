package com.hackademy.server.arena;

import java.util.List;

/** The question shape the battle engine plays: four answers, one correct index and the categories the database accepts. */
public final class ArenaQuestionRules {
    public static final String CATEGORY_PATTERN = "WEB|SIECI|KRYPTOGRAFIA|LINUX|OGOLNE";
    public static final String DIFFICULTY_PATTERN = "EASY|MEDIUM|HARD";
    public static final List<String> CATEGORIES = List.of(CATEGORY_PATTERN.split("\\|"));
    public static final List<String> DIFFICULTIES = List.of(DIFFICULTY_PATTERN.split("\\|"));
    public static final int CONTENT_LENGTH = 500;
    public static final int ANSWER_LENGTH = 200;

    private ArenaQuestionRules() {}
}
