package com.hackademy.server.arena;

public record ReactionOutcome(Status status, long retryAfterMillis) {
    public enum Status { SENT, NOT_PLAYER, UNKNOWN_REACTION, TOO_FAST }

    static ReactionOutcome of(Status status) {
        return new ReactionOutcome(status, 0);
    }
}
