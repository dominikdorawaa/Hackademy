package com.hackademy.server.arena;

import java.util.Arrays;
import java.util.Optional;

public enum QuickReaction {
    EZ("ez"),
    GG("gg"),
    LAUGH("laugh"),
    SHOCK("shock"),
    SIX_SEVEN("67"),
    GROOVE("groove");

    private final String id;

    QuickReaction(String id) {
        this.id = id;
    }

    public String id() {
        return id;
    }

    public static Optional<QuickReaction> fromId(String id) {
        return Arrays.stream(values()).filter(reaction -> reaction.id.equals(id)).findFirst();
    }
}
