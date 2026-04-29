package com.hackademy.server.service;

import com.hackademy.server.dto.DashboardSummaryDto;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;

@Component
public class DashboardSummaryCache {

    private static final long CACHE_MS = 600_000; // 10 minutes (invalidated on user actions)

    private static final class CacheEntry<T> {
        final long timeMs;
        final T value;
        CacheEntry(long timeMs, T value) { this.timeMs = timeMs; this.value = value; }
    }

    private final ConcurrentHashMap<Long, CacheEntry<DashboardSummaryDto>> byUserId = new ConcurrentHashMap<>();

    public DashboardSummaryDto getIfFresh(Long userId) {
        if (userId == null) return null;
        long now = System.currentTimeMillis();
        CacheEntry<DashboardSummaryDto> cached = byUserId.get(userId);
        if (cached != null && now - cached.timeMs <= CACHE_MS) {
            return cached.value;
        }
        return null;
    }

    public void put(Long userId, DashboardSummaryDto dto) {
        if (userId == null || dto == null) return;
        byUserId.put(userId, new CacheEntry<>(System.currentTimeMillis(), dto));
    }

    public void invalidateUser(Long userId) {
        if (userId == null) return;
        byUserId.remove(userId);
    }
}

