package com.hackademy.server.room;

import com.hackademy.server.ratelimit.RateLimitProperties;
import com.hackademy.server.ratelimit.RateLimiter;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
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

class RoomAnswerGuardTest {

    private final SteppingClock clock = new SteppingClock();
    private final RoomAnswerGuard guard = guard(clock, true, 3, Duration.ofMinutes(3));

    static RoomAnswerGuard guard(Clock clock, boolean enabled, int burst, Duration window) {
        var any = new RateLimitProperties.Rule(1000, 1000, Duration.ofMinutes(1));
        var answers = new RateLimitProperties.Rule(burst, burst, window);
        var rules = new RateLimitProperties.Rules(any, any, any, any, any, any, any, answers);
        return new RoomAnswerGuard(new RateLimitProperties(enabled, 100, rules), new RateLimiter(clock, 100));
    }

    @Test
    void blocksTheRoomAfterTheBurstOfWrongAnswersWithTheTimeUntilTheNextTry() {
        wrong(1L, 10L, 3);

        var blocked = assertThrows(RoomAnswerLimitException.class, () -> guard.check(1L, 10L, () -> false));

        assertEquals(60, blocked.retryAfterSeconds());
        assertEquals("Zbyt wiele błędnych odpowiedzi w tym pokoju. Spróbuj ponownie za 60 s.", blocked.getMessage());
    }

    @Test
    void refusesEvenTheRightAnswerWithoutComparingItWhileBlocked() {
        wrong(1L, 10L, 3);
        var compared = new AtomicInteger();

        assertThrows(RoomAnswerLimitException.class, () -> guard.check(1L, 10L, () -> compared.incrementAndGet() > 0));

        assertEquals(0, compared.get());
    }

    @Test
    void rightAnswersDoNotUseUpTheBudget() {
        for (int i = 0; i < 10; i++) {
            assertTrue(guard.check(1L, 10L, () -> true));
        }

        wrong(1L, 10L, 3);
    }

    @Test
    void anAnswerThatFailsToBeJudgedDoesNotCount() {
        for (int i = 0; i < 5; i++) {
            assertThrows(IllegalStateException.class, () -> guard.check(1L, 10L, () -> {
                throw new IllegalStateException("database down");
            }));
        }

        wrong(1L, 10L, 3);
    }

    @Test
    void aBlockedRoomDoesNotBlockOtherRoomsOrOtherPlayers() {
        wrong(1L, 10L, 3);

        assertTrue(guard.check(1L, 11L, () -> true));
        assertFalse(guard.check(1L, 11L, () -> false));
        assertTrue(guard.check(2L, 10L, () -> true));
        assertFalse(guard.check(2L, 10L, () -> false));
    }

    @Test
    void letsThePlayerTryAgainOnceTheBlockExpires() {
        wrong(1L, 10L, 3);
        clock.advance(Duration.ofSeconds(59));
        assertThrows(RoomAnswerLimitException.class, () -> guard.check(1L, 10L, () -> true));

        clock.advance(Duration.ofSeconds(1));

        assertTrue(guard.check(1L, 10L, () -> true));
        assertFalse(guard.check(1L, 10L, () -> false));
        assertThrows(RoomAnswerLimitException.class, () -> guard.check(1L, 10L, () -> true));

        clock.advance(Duration.ofMinutes(3));
        wrong(1L, 10L, 3);
    }

    @Test
    void comparesEveryAnswerWhenRateLimitingIsDisabled() {
        var disabled = guard(clock, false, 1, Duration.ofHours(1));

        for (int i = 0; i < 10; i++) {
            assertFalse(disabled.check(1L, 10L, () -> false));
        }
        assertTrue(disabled.check(1L, 10L, () -> true));
    }

    @Test
    void parallelWrongAnswersNeverExceedTheBurst() throws Exception {
        var judged = new AtomicInteger();
        var blocked = new AtomicInteger();
        var start = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(16);
        try {
            var futures = new ArrayList<Future<?>>();
            for (int i = 0; i < 16; i++) {
                futures.add(pool.submit(() -> {
                    start.await();
                    for (int j = 0; j < 10; j++) {
                        try {
                            guard.check(1L, 10L, () -> {
                                judged.incrementAndGet();
                                Thread.onSpinWait();
                                return false;
                            });
                        } catch (RoomAnswerLimitException e) {
                            blocked.incrementAndGet();
                        }
                    }
                    return null;
                }));
            }
            start.countDown();
            for (var future : futures) future.get(10, TimeUnit.SECONDS);
        } finally {
            pool.shutdownNow();
        }

        assertEquals(3, judged.get());
        assertEquals(157, blocked.get());
    }

    private void wrong(Long userId, Long roomId, int times) {
        for (int i = 0; i < times; i++) {
            assertFalse(guard.check(userId, roomId, () -> false));
        }
    }

    private static final class SteppingClock extends Clock {

        private volatile Instant now = Instant.parse("2026-10-27T12:00:00Z");

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
