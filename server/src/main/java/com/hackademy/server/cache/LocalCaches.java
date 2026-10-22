package com.hackademy.server.cache;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Scheduler;
import java.time.Duration;

public final class LocalCaches {
    private LocalCaches() {}

    public static <K, V> Cache<K, V> bounded(int limit, Duration ttl) {
        return Caffeine.newBuilder().maximumSize(limit).expireAfterWrite(ttl)
                .scheduler(Scheduler.systemScheduler()).build();
    }

    public static <K, V> Cache<K, V> weighted(int limit, Duration ttl, java.util.function.ToIntFunction<V> weight) {
        return Caffeine.newBuilder().maximumWeight(limit)
                .weigher((K key, V value) -> Math.max(1, weight.applyAsInt(value)))
                .expireAfterWrite(ttl).scheduler(Scheduler.systemScheduler()).build();
    }
}
