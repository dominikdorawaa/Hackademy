package com.hackademy.server.arena;

import java.time.LocalDateTime;

public record ReactionOutcome(Status status, LocalDateTime mutedUntil, long retryAfterMillis) {
    public enum Status { SENT, NOT_PLAYER, UNKNOWN_REACTION, MUTED, TOO_FAST }

    static ReactionOutcome of(Status status) {
        return new ReactionOutcome(status, null, 0);
    }
}
