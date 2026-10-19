package com.hackademy.server.proxy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OriginGuardPropertiesTest {

    private static final String FIRST = "a".repeat(32);
    private static final String SECOND = "b".repeat(64);

    @Test
    void isDisabledWithoutSecrets() {
        assertFalse(new OriginGuardProperties(null).enabled());
        assertFalse(new OriginGuardProperties(List.of()).enabled());
        assertFalse(new OriginGuardProperties(Arrays.asList("", " ", null)).enabled());
    }

    @Test
    void trimsAndDeduplicatesSecretsInOrder() {
        var properties = new OriginGuardProperties(List.of(" " + SECOND + " ", FIRST, SECOND));

        assertTrue(properties.enabled());
        assertEquals(List.of(SECOND, FIRST), properties.secrets());
    }

    @ParameterizedTest
    @ValueSource(strings = {"short", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "aaaaaaaaaaaaaaaa aaaaaaaaaaaaaaaa", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaą"})
    void rejectsWeakOrHeaderUnsafeSecrets(String secret) {
        var exception = assertThrows(IllegalArgumentException.class, () -> new OriginGuardProperties(List.of(secret)));

        assertFalse(exception.getMessage().contains(secret));
    }

    @Test
    void neverPrintsSecrets() {
        var properties = new OriginGuardProperties(List.of(FIRST, SECOND));

        assertEquals("OriginGuardProperties[secrets=2 configured]", properties.toString());
    }

    @Test
    void bindsCommaSeparatedEnvironmentValueForRotation() {
        var binder = new Binder(new MapConfigurationPropertySource(Map.of(
                "application.origin-guard.secrets", FIRST + "," + SECOND)));

        var properties = binder.bindOrCreate("application.origin-guard", OriginGuardProperties.class);

        assertEquals(List.of(FIRST, SECOND), properties.secrets());
    }

    @Test
    void bindsEmptyEnvironmentValueAsDisabled() {
        var binder = new Binder(new MapConfigurationPropertySource(Map.of("application.origin-guard.secrets", "")));

        var properties = binder.bindOrCreate("application.origin-guard", OriginGuardProperties.class);

        assertFalse(properties.enabled());
    }
}
