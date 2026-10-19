package com.hackademy.server.proxy;

import org.junit.jupiter.api.Test;
import org.springframework.core.Ordered;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OriginGuardConfigTest {

    private final OriginGuardConfig config = new OriginGuardConfig();

    @Test
    void registersTheGuardFirstWhenSecretsAreConfigured() {
        var registration = config.originGuardFilterRegistration(new OriginGuardProperties(List.of("s".repeat(40))));

        assertTrue(registration.isEnabled());
        assertEquals(Ordered.HIGHEST_PRECEDENCE, registration.getOrder());
        assertEquals(List.of("/*"), List.copyOf(registration.getUrlPatterns()));
    }

    @Test
    void leavesTheGuardOffWithoutSecrets() {
        var registration = config.originGuardFilterRegistration(new OriginGuardProperties(List.of()));

        assertFalse(registration.isEnabled());
    }
}
