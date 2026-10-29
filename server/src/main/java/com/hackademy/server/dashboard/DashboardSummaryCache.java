package com.hackademy.server.dashboard;

import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.concurrent.ConcurrentHashMap;

@Component
public class DashboardSummaryCache {

    private long generation;

    public synchronized long generation() { return generation; }

    public synchronized void invalidateAll() { generation++; byUserId.invalidateAll(); }

    public void invalidateAllAfterCommit() {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            invalidateAll();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() { invalidateAll(); }
        });
    }

    private static final long CACHE_MS = 600_000;

    private static final class CacheEntry<T> {
        final long timeMs;
        final T value;
        CacheEntry(long timeMs, T value) { this.timeMs = timeMs; this.value = value; }
    }

    private final com.github.benmanes.caffeine.cache.Cache<Long, CacheEntry<DashboardSummaryDto>> byUserId = com.hackademy.server.cache.LocalCaches.bounded(512, java.time.Duration.ofMinutes(10));

    public DashboardSummaryDto load(Long id, java.util.function.Supplier<DashboardSummaryDto> loader) {
        return byUserId.get(id, key -> new CacheEntry<>(System.currentTimeMillis(), loader.get())).value;
    }

    public DashboardSummaryDto getIfFresh(Long userId) {
        if (userId == null) return null;
        long now = System.currentTimeMillis();
        CacheEntry<DashboardSummaryDto> cached = byUserId.getIfPresent(userId);
        if (cached != null && now - cached.timeMs <= CACHE_MS) {
            return cached.value;
        }
        return null;
    }

    public synchronized void put(Long userId, DashboardSummaryDto dto, long expectedGeneration) {
        if (userId == null || dto == null || expectedGeneration != generation) return;
        byUserId.put(userId, new CacheEntry<>(System.currentTimeMillis(), dto));
    }

    public void invalidateUser(Long userId) {
        if (userId == null) return;
        byUserId.invalidate(userId);
    }
}

