package com.hackademy.server.room;

import com.hackademy.server.ratelimit.RateLimitDecision;
import com.hackademy.server.ratelimit.RateLimitProperties;
import com.hackademy.server.ratelimit.RateLimiter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.function.BooleanSupplier;

/**
 * Limits flag and task-answer guessing per user and room. Only wrong answers use up the budget; while it is spent,
 * answers are refused before they are compared, so a block never reveals whether a guess was right.
 */
@Component
@RequiredArgsConstructor
public class RoomAnswerGuard {

    static final String SCOPE = "room-answer";

    private final RateLimitProperties properties;
    private final RateLimiter rateLimiter;

    public boolean check(Long userId, Long roomId, BooleanSupplier correct) {
        if (!properties.enabled()) {
            return correct.getAsBoolean();
        }
        RateLimiter.Lease lease = rateLimiter.lease(SCOPE, userId + ":" + roomId, properties.rules().roomAnswer());
        RateLimitDecision decision = lease.decision();
        if (!decision.allowed()) {
            throw new RoomAnswerLimitException(decision.retryAfterSeconds());
        }
        boolean wrong = false;
        try {
            wrong = !correct.getAsBoolean();
            return !wrong;
        } finally {
            if (!wrong) {
                lease.release();
            }
        }
    }
}
