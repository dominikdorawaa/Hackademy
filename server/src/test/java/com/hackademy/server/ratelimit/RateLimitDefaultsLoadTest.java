package com.hackademy.server.ratelimit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RateLimitDefaultsLoadTest {

    private static final String SCHOOL = "ip:198.51.100.1";
    private static final int STUDENTS = 30;
    private static final int BANNERS = 10;

    private final MutableClock clock = new MutableClock();
    private final long start = clock.millis();
    private RateLimitProperties properties;
    private RateLimiter limiter;
    private final List<Event> events = new ArrayList<>();

    @BeforeEach
    void loadDefaults() throws Exception {
        var environment = new StandardEnvironment();
        new YamlPropertySourceLoader().load("application", new ClassPathResource("application.yml"))
                .forEach(environment.getPropertySources()::addLast);
        properties = Binder.get(environment).bind("application.rate-limit", RateLimitProperties.class).get();
        limiter = new RateLimiter(clock, properties.maxKeys());
    }

    @Test
    void enablesTheLimiterByDefault() {
        assertTrue(properties.enabled());
    }

    @Test
    void letsOneAccountSendABugReportEveryThirtySeconds() {
        for (long t = 0; t < 300_000; t += 10_000) {
            at(t, RateLimitGroup.BUG_REPORT, "account:reporter", 1);
        }

        assertEquals(new RateLimitProperties.Rule(1, 1, Duration.ofSeconds(30)), properties.rule(RateLimitGroup.BUG_REPORT));
        assertEquals(20, refusals().get(RateLimitGroup.BUG_REPORT));
    }

    @Test
    void aClassBehindOneSchoolAddressWorksForTenMinutesWithoutRefusals() {
        for (int student = 0; student < STUDENTS; student++) {
            String account = "account:student-" + student;
            long login = student * 300L;
            coldStartWithBlockedWebSocket(account, login);
            for (long t = login + 15_000; t < 600_000; t += 15_000) {
                at(t, RateLimitGroup.API_READ, account, 1);
                at(t + 1, RateLimitGroup.API_WRITE, account, 1);
            }
            for (long t = login; t < 600_000; t += 1_000) {
                at(t + 2, RateLimitGroup.WEBSOCKET_TRANSPORT, SCHOOL, t < 60_000 ? 1 : 0);
            }
            for (long t = login; t < 60_000; t += 5_000) {
                at(t + 3, RateLimitGroup.WEBSOCKET_TRANSPORT, SCHOOL, 3);
            }
            for (long t = login; t < 600_000; t += 5_000) {
                at(t + 4, RateLimitGroup.WEBSOCKET_TRANSPORT, SCHOOL, 1);
            }
            rapidNavigation(account, 120_000 + student * 200L);
            at(180_000 + student * 300L, RateLimitGroup.API_READ, account, 1);
            at(180_000 + student * 300L + 50, RateLimitGroup.PUBLIC_BANNER, SCHOOL, BANNERS);
            coldStartWithBlockedWebSocket(account, 240_000 + student * 100L);
            coldStartWithBlockedWebSocket(account, 241_000 + student * 100L);
            at(300_000 + student * 300L, RateLimitGroup.ANONYMOUS, SCHOOL, 1);
        }

        assertEquals(Map.of(), refusals());
    }

    @Test
    void everyOpenTabCanReconnectAfterARestart() {
        for (int tab = 0; tab < 2 * STUDENTS; tab++) {
            at(5_000 + tab * 50L, RateLimitGroup.WEBSOCKET_HANDSHAKE, SCHOOL, 3);
            at(5_000 + tab * 50L + 10, RateLimitGroup.WEBSOCKET_TRANSPORT, SCHOOL, 2);
            at(5_000 + tab * 50L + 20, RateLimitGroup.API_READ, "account:tab-" + tab / 2, 1);
        }

        assertEquals(Map.of(), refusals());
    }

    @Test
    void aFullArenaBattleWithReactionsStaysWithinTheWriteBudget() {
        String account = "account:duelist";
        coldStartWithBlockedWebSocket(account, 0);
        for (int round = 0; round < 10; round++) {
            long roundStart = 1_000 + round * 18_000L;
            at(roundStart + 2_000, RateLimitGroup.API_WRITE, account, 1);
            for (int reaction = 0; reaction < 5; reaction++) {
                at(roundStart + reaction * 1_500L, RateLimitGroup.API_WRITE, account, 2);
            }
            at(roundStart + 15_000, RateLimitGroup.API_WRITE, account, 1);
        }

        assertEquals(Map.of(), refusals());
    }

    @Test
    void aScriptFromOneAddressIsStoppedQuickly() {
        for (long t = 0; t < 120_000; t += 100) {
            at(t, RateLimitGroup.ANONYMOUS, "ip:203.0.113.66", 1);
        }

        var rule = properties.rule(RateLimitGroup.ANONYMOUS);
        int admittable = rule.burst() + rule.limit() * 2 + 1;

        var refused = refusals().get(RateLimitGroup.ANONYMOUS);

        assertTrue(refused >= 1_200 - admittable, "refused " + refused);
    }

    @Test
    void oneAccountHammeringTheApiIsStoppedQuickly() {
        for (long t = 0; t < 60_000; t += 50) {
            at(t, RateLimitGroup.API_READ, "account:script", 1);
            at(t, RateLimitGroup.API_WRITE, "account:script", 1);
        }

        var read = properties.rule(RateLimitGroup.API_READ);
        var write = properties.rule(RateLimitGroup.API_WRITE);

        var refused = refusals();

        assertTrue(refused.get(RateLimitGroup.API_READ) >= 1_200 - read.burst() - read.limit() - 1, "reads " + refused);
        assertTrue(refused.get(RateLimitGroup.API_WRITE) >= 1_200 - write.burst() - write.limit() - 1, "writes " + refused);
    }

    private void coldStartWithBlockedWebSocket(String account, long t) {
        at(t, RateLimitGroup.API_READ, account, 12);
        at(t + 10, RateLimitGroup.WEBSOCKET_HANDSHAKE, SCHOOL, 3);
        at(t + 20, RateLimitGroup.WEBSOCKET_TRANSPORT, SCHOOL, 2);
    }

    private void rapidNavigation(String account, long t) {
        int[] pages = {12, 9, 8, 3, 1, 9, 8};
        for (int i = 0; i < pages.length; i++) {
            at(t + i * 1_400L, RateLimitGroup.API_READ, account, pages[i]);
        }
    }

    private void at(long offset, RateLimitGroup group, String id, int count) {
        for (int i = 0; i < count; i++) {
            events.add(new Event(start + offset, group, id));
        }
    }

    private Map<RateLimitGroup, Integer> refusals() {
        events.sort(Comparator.comparingLong(Event::time));
        Map<RateLimitGroup, Integer> refused = new EnumMap<>(RateLimitGroup.class);
        for (Event event : events) {
            long wait = event.time() - clock.millis();
            if (wait > 0) clock.advance(Duration.ofMillis(wait));
            if (!limiter.acquire(event.group().name(), event.id(), properties.rule(event.group())).allowed()) {
                refused.merge(event.group(), 1, Integer::sum);
            }
        }
        return refused;
    }

    private record Event(long time, RateLimitGroup group, String id) {
    }
}
