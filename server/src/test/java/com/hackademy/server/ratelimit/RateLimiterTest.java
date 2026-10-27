package com.hackademy.server.ratelimit;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.ArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RateLimiterTest {

    private static final RateLimitProperties.Rule RULE = new RateLimitProperties.Rule(3, 60, Duration.ofMinutes(1));

    private final MutableClock clock = new MutableClock();
    private final RateLimiter limiter = new RateLimiter(clock, 100);

    @Test
    void allowsTheBurstAndThenRejectsWithTheTimeUntilTheNextToken() {
        for (int i = 0; i < 3; i++) {
            assertTrue(limiter.acquire("api", "a", RULE).allowed());
        }

        var rejected = limiter.acquire("api", "a", RULE);

        assertFalse(rejected.allowed());
        assertEquals(1000, rejected.retryAfterMillis());
        assertEquals(1, rejected.retryAfterSeconds());
    }

    @Test
    void refillsAtTheConfiguredRateAndNeverAboveTheBurst() {
        drain("a", 3);
        clock.advance(Duration.ofMillis(999));
        assertFalse(limiter.acquire("api", "a", RULE).allowed());

        clock.advance(Duration.ofMillis(1));
        assertTrue(limiter.acquire("api", "a", RULE).allowed());
        assertFalse(limiter.acquire("api", "a", RULE).allowed());

        clock.advance(Duration.ofHours(1));
        assertEquals(3, drain("a", 10));
    }

    @Test
    void rejectedRequestsDoNotPostponeRecovery() {
        drain("a", 3);
        for (int i = 0; i < 50; i++) {
            assertFalse(limiter.acquire("api", "a", RULE).allowed());
        }

        clock.advance(Duration.ofSeconds(1));

        assertTrue(limiter.acquire("api", "a", RULE).allowed());
    }

    @Test
    void reportsWholeSecondsForSlowRules() {
        var slow = new RateLimitProperties.Rule(1, 2, Duration.ofMinutes(1));
        limiter.acquire("slow", "a", slow);

        var rejected = limiter.acquire("slow", "a", slow);

        assertEquals(30_000, rejected.retryAfterMillis());
        assertEquals(30, rejected.retryAfterSeconds());
        assertEquals(2, new RateLimitDecision(false, 1001).retryAfterSeconds());
    }

    @Test
    void keepsKeysAndScopesIndependent() {
        drain("a", 3);

        assertTrue(limiter.acquire("api", "b", RULE).allowed());
        assertTrue(limiter.acquire("other", "a", RULE).allowed());
        assertFalse(limiter.acquire("api", "a", RULE).allowed());
    }

    @Test
    void forgetsIdleKeysOnceTheyHaveFullyRefilled() {
        drain("a", 1);
        drain("b", 3);
        assertEquals(2, limiter.size());

        clock.advance(Duration.ofSeconds(61));
        limiter.acquire("api", "c", RULE);

        assertEquals(1, limiter.size());
    }

    @Test
    void keepsKeysThatStillHaveADebtDuringASweep() {
        var slow = new RateLimitProperties.Rule(2, 1, Duration.ofMinutes(10));
        limiter.acquire("slow", "a", slow);
        limiter.acquire("slow", "a", slow);

        clock.advance(Duration.ofSeconds(61));
        limiter.acquire("api", "c", RULE);

        assertEquals(2, limiter.size());
        assertFalse(limiter.acquire("slow", "a", slow).allowed());
    }

    @Test
    void sharesAnOverflowBucketWhenTheKeyTableIsFull() {
        var small = new RateLimiter(clock, 2);
        small.acquire("api", "a", RULE);
        small.acquire("api", "b", RULE);

        for (int i = 0; i < 3; i++) {
            assertTrue(small.acquire("api", "new-" + i, RULE).allowed());
        }

        assertFalse(small.acquire("api", "another", RULE).allowed());
        assertEquals(3, small.size());
        assertTrue(small.acquire("api", "a", RULE).allowed());
    }

    @Test
    void reclaimsTheTableWhenFullBeforeUsingTheOverflowBucket() {
        var small = new RateLimiter(clock, 1);
        small.acquire("api", "a", RULE);
        clock.advance(Duration.ofSeconds(5));

        small.acquire("api", "b", RULE);

        assertEquals(1, small.size());
        assertEquals(3, drainOn(small, "b", 5) + 1);
    }

    @Test
    void ignoresAClockThatMovesBackwards() {
        drain("a", 3);
        clock.advance(Duration.ofSeconds(-30));

        assertFalse(limiter.acquire("api", "a", RULE).allowed());
        clock.advance(Duration.ofSeconds(31));
        assertTrue(limiter.acquire("api", "a", RULE).allowed());
    }

    @Test
    void neverAdmitsMoreThanTheBurstUnderConcurrency() throws Exception {
        var rule = new RateLimitProperties.Rule(50, 1, Duration.ofHours(1));
        var allowed = new AtomicInteger();
        var start = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(16);
        try {
            var futures = new ArrayList<Future<?>>();
            for (int i = 0; i < 16; i++) {
                futures.add(pool.submit(() -> {
                    start.await();
                    for (int j = 0; j < 100; j++) {
                        if (limiter.acquire("api", "shared", rule).allowed()) allowed.incrementAndGet();
                    }
                    return null;
                }));
            }
            start.countDown();
            for (var future : futures) future.get(10, TimeUnit.SECONDS);
        } finally {
            pool.shutdownNow();
        }

        assertEquals(50, allowed.get());
    }

    @Test
    void neverAdmitsMoreThanTheBurstWhileSweepsRetireBuckets() throws Exception {
        var tiny = new RateLimiter(clock, 1);
        var rule = new RateLimitProperties.Rule(20, 1, Duration.ofHours(1));
        var allowed = new AtomicInteger();
        var pool = Executors.newFixedThreadPool(8);
        try {
            var futures = new ArrayList<Future<?>>();
            for (int i = 0; i < 8; i++) {
                int worker = i;
                futures.add(pool.submit(() -> {
                    for (int j = 0; j < 200; j++) {
                        if (tiny.acquire("api", "shared", rule).allowed()) allowed.incrementAndGet();
                        tiny.acquire("api", "noise-" + worker + "-" + j, rule);
                        if (j % 20 == 0) clock.advance(Duration.ofMillis(1001));
                    }
                    return null;
                }));
            }
            for (var future : futures) future.get(10, TimeUnit.SECONDS);
        } finally {
            pool.shutdownNow();
        }

        assertTrue(allowed.get() <= 20 + 1, "admitted " + allowed.get());
    }

    @Test
    void aReleasedLeaseGivesItsTokenBack() {
        var lease = limiter.lease("api", "a", RULE);
        drain("a", 2);
        assertFalse(limiter.acquire("api", "a", RULE).allowed());

        lease.release();
        lease.release();

        assertTrue(limiter.acquire("api", "a", RULE).allowed());
        assertFalse(limiter.acquire("api", "a", RULE).allowed());
    }

    @Test
    void releasingNeverRaisesABucketAboveItsBurst() {
        var lease = limiter.lease("api", "a", RULE);
        clock.advance(Duration.ofHours(1));

        lease.release();

        assertEquals(3, drain("a", 10));
    }

    @Test
    void aRejectedLeaseHasNothingToGiveBack() {
        drain("a", 3);
        var rejected = limiter.lease("api", "a", RULE);

        rejected.release();

        assertFalse(rejected.decision().allowed());
        assertEquals(1000, rejected.decision().retryAfterMillis());
        assertFalse(limiter.acquire("api", "a", RULE).allowed());
    }

    @Test
    void releasingARetiredBucketDoesNotTouchItsReplacement() {
        var lease = limiter.lease("api", "a", RULE);
        clock.advance(Duration.ofSeconds(61));
        limiter.acquire("api", "sweep", RULE);
        drain("a", 3);

        lease.release();

        assertFalse(limiter.acquire("api", "a", RULE).allowed());
    }

    @Test
    void neverAdmitsMoreThanTheBurstWhileLeasesAreHeld() throws Exception {
        var rule = new RateLimitProperties.Rule(5, 1, Duration.ofHours(1));
        var allowed = new AtomicInteger();
        var start = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(16);
        try {
            var futures = new ArrayList<Future<?>>();
            for (int i = 0; i < 16; i++) {
                futures.add(pool.submit(() -> {
                    start.await();
                    for (int j = 0; j < 20; j++) {
                        if (limiter.lease("api", "shared", rule).decision().allowed()) allowed.incrementAndGet();
                    }
                    return null;
                }));
            }
            start.countDown();
            for (var future : futures) future.get(10, TimeUnit.SECONDS);
        } finally {
            pool.shutdownNow();
        }

        assertEquals(5, allowed.get());
    }

    @Test
    void rejectsAnEmptyKeyTable() {
        assertThrows(IllegalArgumentException.class, () -> new RateLimiter(clock, 0));
    }

    private int drain(String id, int attempts) {
        return drainOn(limiter, id, attempts);
    }

    private int drainOn(RateLimiter target, String id, int attempts) {
        int allowed = 0;
        for (int i = 0; i < attempts; i++) {
            if (target.acquire("api", id, RULE).allowed()) allowed++;
        }
        return allowed;
    }
}
