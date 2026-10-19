package com.hackademy.server.cors;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.context.properties.bind.BindException;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;

class CorsPropertiesTest {

    @Test
    void normalizesOriginsToTheFormBrowsersSend() {
        var properties = new CorsProperties(List.of(" HTTPS://Hackademy.App/ ", "https://hackademy.app:443",
                "http://localhost:80", "http://localhost:5173", "http://[::1]:5173"));

        assertEquals(List.of("https://hackademy.app", "http://localhost", "http://localhost:5173", "http://[::1]:5173"),
                properties.allowedOrigins());
    }

    @Test
    void keepsNonDefaultPortsAndSchemesDistinct() {
        var properties = new CorsProperties(List.of("https://hackademy.app:8443", "http://hackademy.app",
                "https://localhost:80", "http://localhost:443"));

        assertEquals(List.of("https://hackademy.app:8443", "http://hackademy.app", "https://localhost:80",
                "http://localhost:443"), properties.allowedOrigins());
    }

    @ParameterizedTest
    @NullAndEmptySource
    void requiresAtLeastOneOrigin(List<String> origins) {
        var exception = assertThrows(IllegalArgumentException.class, () -> new CorsProperties(origins));

        assertEquals("application.cors.allowed-origins must list at least one origin", exception.getMessage());
    }

    @Test
    void rejectsMissingOriginEntry() {
        assertThrows(IllegalArgumentException.class, () -> new CorsProperties(Arrays.asList("https://hackademy.app", null)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "*", "https://*.hackademy.app", "https://*", "hackademy.app", "localhost:5173",
            "ftp://hackademy.app", "wss://hackademy.app", "https://user@hackademy.app", "https://hackademy.app/app",
            "https://hackademy.app//", "https://hackademy.app?preview=1", "https://hackademy.app#top", "https://",
            "https://hack ademy.app", "https://hackademy_app.example", "null", "/relative"})
    void rejectsValuesThatAreNotExactOrigins(String origin) {
        var exception = assertThrows(IllegalArgumentException.class, () -> new CorsProperties(List.of(origin)));

        assertEquals("Invalid CORS origin '" + origin + "'; use scheme://host[:port] without a path or wildcard",
                exception.getMessage());
    }

    @Test
    void bindsCommaSeparatedEnvironmentValue() {
        var binder = new Binder(new MapConfigurationPropertySource(Map.of(
                "application.cors.allowed-origins", "https://hackademy.app, http://localhost:5173")));

        var properties = binder.bindOrCreate("application.cors", CorsProperties.class);

        assertEquals(List.of("https://hackademy.app", "http://localhost:5173"), properties.allowedOrigins());
    }

    @Test
    void failsBindingForInvalidEnvironmentValue() {
        var binder = new Binder(new MapConfigurationPropertySource(Map.of(
                "application.cors.allowed-origins", "https://hackademy.app,*")));

        var exception = assertThrows(BindException.class, () -> binder.bindOrCreate("application.cors", CorsProperties.class));

        Throwable cause = exception;
        while (cause.getCause() != null) {
            cause = cause.getCause();
        }
        assertInstanceOf(IllegalArgumentException.class, cause);
    }
}
