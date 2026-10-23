package com.hackademy.server.ratelimit;

public record RateLimitDecision(boolean allowed, long retryAfterMillis) {

    static final RateLimitDecision ALLOWED = new RateLimitDecision(true, 0);

    public long retryAfterSeconds() {
        return Math.max(1, (retryAfterMillis + 999) / 1000);
    }
}
