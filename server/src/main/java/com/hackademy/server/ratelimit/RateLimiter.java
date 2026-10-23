package com.hackademy.server.ratelimit;

import java.time.Clock;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

public class RateLimiter {

    static final String OVERFLOW = "overflow";
    static final long SWEEP_INTERVAL_MILLIS = 60_000;
    static final long FULL_SWEEP_INTERVAL_MILLIS = 1_000;

    private final Clock clock;
    private final int maxKeys;
    private final ConcurrentHashMap<Key, Bucket> buckets = new ConcurrentHashMap<>();
    private final AtomicLong lastSweep;

    public RateLimiter(Clock clock, int maxKeys) {
        if (maxKeys < 1) {
            throw new IllegalArgumentException("maxKeys must be positive");
        }
        this.clock = clock;
        this.maxKeys = maxKeys;
        this.lastSweep = new AtomicLong(clock.millis());
    }

    public RateLimitDecision acquire(String scope, String id, RateLimitProperties.Rule rule) {
        long now = clock.millis();
        sweep(now, SWEEP_INTERVAL_MILLIS);
        Key key = new Key(scope, id);
        while (true) {
            Bucket bucket = buckets.get(key);
            if (bucket == null) {
                if (buckets.size() >= maxKeys) {
                    sweep(now, FULL_SWEEP_INTERVAL_MILLIS);
                    if (buckets.size() >= maxKeys) {
                        key = new Key(scope, OVERFLOW);
                    }
                }
                bucket = buckets.computeIfAbsent(key, ignored -> new Bucket(rule, now));
            }
            RateLimitDecision decision = bucket.acquire(now);
            if (decision != null) {
                return decision;
            }
        }
    }

    int size() {
        return buckets.size();
    }

    private void sweep(long now, long minimumGap) {
        long last = lastSweep.get();
        if (now - last < minimumGap || !lastSweep.compareAndSet(last, now)) {
            return;
        }
        buckets.forEach((key, bucket) -> {
            if (bucket.retireIfFull(now)) {
                buckets.remove(key, bucket);
            }
        });
    }

    private record Key(String scope, String id) {
    }

    private static final class Bucket {

        private final int capacity;
        private final double tokensPerMilli;
        private double tokens;
        private long updatedAt;
        private boolean retired;

        Bucket(RateLimitProperties.Rule rule, long now) {
            this.capacity = rule.burst();
            this.tokensPerMilli = rule.tokensPerMilli();
            this.tokens = capacity;
            this.updatedAt = now;
        }

        synchronized RateLimitDecision acquire(long now) {
            if (retired) {
                return null;
            }
            refill(now);
            if (tokens >= 1) {
                tokens -= 1;
                return RateLimitDecision.ALLOWED;
            }
            return new RateLimitDecision(false, (long) Math.ceil((1 - tokens) / tokensPerMilli));
        }

        synchronized boolean retireIfFull(long now) {
            refill(now);
            retired = tokens >= capacity;
            return retired;
        }

        private void refill(long now) {
            if (now > updatedAt) {
                tokens = Math.min(capacity, tokens + (now - updatedAt) * tokensPerMilli);
                updatedAt = now;
            }
        }
    }
}
