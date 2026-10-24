package com.hackademy.server.ratelimit;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

class RateLimitPropertiesTest {

    private static final RateLimitProperties.Rule RULE = new RateLimitProperties.Rule(1, 1, Duration.ofSeconds(1));

    @ParameterizedTest
    @CsvSource({"0, 1, 1000", "1, 0, 1000", "1, 1, 0", "-1, 1, 1000"})
    void rejectsRulesThatWouldBlockEverything(int burst, int limit, long windowMillis) {
        assertThrows(IllegalArgumentException.class,
                () -> new RateLimitProperties.Rule(burst, limit, Duration.ofMillis(windowMillis)));
    }

    @Test
    void requiresAWindow() {
        assertThrows(IllegalArgumentException.class, () -> new RateLimitProperties.Rule(1, 1, null));
    }

    @Test
    void requiresEveryGroupAndAKeyTable() {
        assertThrows(IllegalArgumentException.class, () -> new RateLimitProperties.Rules(null, RULE, RULE, RULE, RULE, RULE, RULE));
        assertThrows(IllegalArgumentException.class, () -> new RateLimitProperties.Rules(RULE, null, RULE, RULE, RULE, RULE, RULE));
        assertThrows(IllegalArgumentException.class, () -> new RateLimitProperties.Rules(RULE, RULE, null, RULE, RULE, RULE, RULE));
        assertThrows(IllegalArgumentException.class, () -> new RateLimitProperties.Rules(RULE, RULE, RULE, null, RULE, RULE, RULE));
        assertThrows(IllegalArgumentException.class, () -> new RateLimitProperties.Rules(RULE, RULE, RULE, RULE, null, RULE, RULE));
        assertThrows(IllegalArgumentException.class, () -> new RateLimitProperties.Rules(RULE, RULE, RULE, RULE, RULE, null, RULE));
        assertThrows(IllegalArgumentException.class, () -> new RateLimitProperties.Rules(RULE, RULE, RULE, RULE, RULE, RULE, null));
        var rules = new RateLimitProperties.Rules(RULE, RULE, RULE, RULE, RULE, RULE, RULE);
        assertThrows(IllegalArgumentException.class, () -> new RateLimitProperties(true, 0, rules));
        assertThrows(IllegalArgumentException.class, () -> new RateLimitProperties(true, 1, null));
    }

    @ParameterizedTest
    @EnumSource(RateLimitGroup.class)
    void returnsTheRuleOfEachGroup(RateLimitGroup group) {
        var rules = new RateLimitProperties.Rules(rule(1), rule(2), rule(3), rule(4), rule(5), rule(6), rule(7));
        var expected = switch (group) {
            case API_READ -> rules.apiRead();
            case API_WRITE -> rules.apiWrite();
            case BUG_REPORT -> rules.bugReport();
            case ANONYMOUS -> rules.anonymous();
            case PUBLIC_BANNER -> rules.publicBanner();
            case WEBSOCKET_HANDSHAKE -> rules.websocketHandshake();
            case WEBSOCKET_TRANSPORT -> rules.websocketTransport();
        };

        assertSame(expected, new RateLimitProperties(true, 1, rules).rule(group));
    }

    private static RateLimitProperties.Rule rule(int burst) {
        return new RateLimitProperties.Rule(burst, 1, Duration.ofSeconds(1));
    }
}
