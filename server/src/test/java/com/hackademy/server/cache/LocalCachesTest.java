package com.hackademy.server.cache;

import org.junit.jupiter.api.Test;
import java.time.Duration;
import java.util.ArrayList;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

class LocalCachesTest {
    @Test
    void parallelMissesShareOneRefreshAndExpiryRemovesOldValues() throws Exception {
        var cache = LocalCaches.<Long, String>bounded(2, Duration.ofMillis(100));
        var loads = new AtomicInteger();
        var start = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(12);
        try {
            var results = new ArrayList<Future<String>>();
            for (int i = 0; i < 30; i++) results.add(pool.submit(() -> {
                start.await();
                return cache.get(1L, key -> { loads.incrementAndGet(); return "one"; });
            }));
            start.countDown();
            for (var result : results) assertEquals("one", result.get(2, TimeUnit.SECONDS));
            assertEquals(1, loads.get());
            Thread.sleep(120);
            assertNull(cache.getIfPresent(1L));
            for (long i = 0; i < 100; i++) cache.put(i, "entry");
            cache.cleanUp();
            assertTrue(cache.estimatedSize() <= 2);
        } finally { pool.shutdownNow(); }
    }

    @Test
    void limitsTotalCollectionWeightInsteadOfOnlyCountingUsers() {
        var cache = LocalCaches.<Long, String>weighted(10, Duration.ofMinutes(1), String::length);
        cache.put(1L, "12345678");
        cache.put(2L, "12345678");
        cache.cleanUp();
        assertTrue(cache.estimatedSize() <= 1);
    }
}
