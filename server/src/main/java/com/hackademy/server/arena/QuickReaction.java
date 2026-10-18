package com.hackademy.server.arena;

import java.util.Arrays;
import java.util.Optional;

public enum QuickReaction {
    EZ("ez"),
    GG("gg"),
    NICE("nice"),
    OOPS("oops"),
    CLOSE("close"),
    FIRE("fire"),
    LAUGH("laugh"),
    SHOCK("shock"),
    CLAP("clap"),
    COOL("cool"),
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
