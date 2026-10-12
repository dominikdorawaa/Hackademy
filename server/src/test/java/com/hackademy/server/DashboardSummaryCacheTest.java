package com.hackademy.server;

import com.hackademy.server.dashboard.DashboardSummaryCache;
import com.hackademy.server.dashboard.DashboardSummaryDto;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DashboardSummaryCacheTest {
    @Test
    void invalidationRejectsResultsFromRequestsStartedBeforePublicationChanged() {
        var cache = new DashboardSummaryCache();
        var old = DashboardSummaryDto.builder().activeSecondsThisWeek(1).build();
        long generation = cache.generation();
        cache.put(1L, old, generation);
        assertSame(old, cache.getIfFresh(1L));
        cache.invalidateAll();
        cache.put(1L, old, generation);
        assertNull(cache.getIfFresh(1L));
        var current = DashboardSummaryDto.builder().activeSecondsThisWeek(2).build();
        cache.put(1L, current, cache.generation());
        assertSame(current, cache.getIfFresh(1L));
        cache.put(null, old, cache.generation());
        cache.put(2L, null, cache.generation());
        assertNull(cache.getIfFresh(2L));
    }
}
