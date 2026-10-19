package com.hackademy.server.clerk;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ClerkPropertiesTest {

    @Test
    void normalizesIssuerAndOptionalValues() {
        var properties = new ClerkProperties(" https://example.clerk.accounts.dev/ ", " ", "", null);

        assertEquals("https://example.clerk.accounts.dev", properties.issuer());
        assertEquals("https://example.clerk.accounts.dev/.well-known/jwks.json", properties.jwksUri());
        assertNull(properties.jwtKey());
        assertNull(properties.secretKey());
        assertEquals(ClerkProperties.DEFAULT_API_URL, properties.apiUrl());
    }

    @Test
    void keepsConfiguredKeysAndApiUrl() {
        var properties = new ClerkProperties("http://localhost:4010", "pem", "sk_test_value", "http://localhost:4011/v1/");

        assertEquals("http://localhost:4010", properties.issuer());
        assertEquals("pem", properties.jwtKey());
        assertEquals("sk_test_value", properties.secretKey());
        assertEquals("http://localhost:4011/v1", properties.apiUrl());
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "example.clerk.accounts.dev", "http://example.clerk.accounts.dev",
            "ftp://example.clerk.accounts.dev", "https://user@example.clerk.accounts.dev",
            "https://example.clerk.accounts.dev/path", "https://example.clerk.accounts.dev?x=1",
            "https://example.clerk.accounts.dev#x", "https://exa mple.dev"})
    void rejectsIssuersThatAreNotAFrontendApiOrigin(String issuer) {
        assertThrows(IllegalArgumentException.class, () -> new ClerkProperties(issuer, null, null, null));
    }
}
