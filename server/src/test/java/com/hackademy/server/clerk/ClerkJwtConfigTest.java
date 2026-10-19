package com.hackademy.server.clerk;

import com.hackademy.server.ClerkTestTokens;
import com.hackademy.server.cors.CorsProperties;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtValidationException;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.interfaces.RSAPublicKey;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ClerkJwtConfigTest {

    private static final String ORIGIN = "https://hackademy.app";
    private final Clock clock = Clock.systemUTC();
    private final ClerkJwtConfig config = new ClerkJwtConfig();
    private final CorsProperties cors = new CorsProperties(List.of(ORIGIN));

    @Test
    void decodesTokensSignedByTheConfiguredPublicKey() {
        var decoder = config.clerkJwtDecoder(properties(ClerkTestTokens.publicKeyPem()), cors, clock);

        Jwt jwt = decoder.decode(ClerkTestTokens.token("user_1", ORIGIN, Map.of("email", "a@example.com")));

        assertEquals("user_1", jwt.getSubject());
        assertEquals("a@example.com", jwt.getClaimAsString("email"));
    }

    @Test
    void acceptsEscapedNewlinesInEnvironmentPem() {
        RSAPublicKey key = ClerkJwtConfig.parsePublicKey(ClerkTestTokens.publicKeyPem().replace("\n", "\\n"));

        assertEquals(ClerkTestTokens.publicKey(), key);
    }

    @Test
    void rejectsMalformedPem() {
        assertThrows(IllegalArgumentException.class, () -> ClerkJwtConfig.parsePublicKey("not a key"));
    }

    @Test
    void decodesTokensUsingTheIssuerJwks() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        byte[] jwks = new JWKSet(new RSAKey.Builder(ClerkTestTokens.publicKey()).keyID("test-key").build())
                .toString().getBytes(StandardCharsets.UTF_8);
        server.createContext("/.well-known/jwks.json", exchange -> {
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, jwks.length);
            exchange.getResponseBody().write(jwks);
            exchange.close();
        });
        server.start();
        try {
            String issuer = "http://127.0.0.1:" + server.getAddress().getPort();
            var decoder = config.clerkJwtDecoder(new ClerkProperties(issuer, null, null, null), cors, clock);
            Instant now = Instant.now();
            String token = ClerkTestTokens.sign(ClerkTestTokens.keys(),
                    ClerkTestTokens.builder("user_2", ORIGIN, now, now.plusSeconds(60), Map.of()).issuer(issuer).build());

            assertEquals("user_2", decoder.decode(token).getSubject());
        } finally {
            server.stop(0);
        }
    }

    @Test
    void rejectsTokensForOtherPartiesIssuersOrSessions() {
        var decoder = config.clerkJwtDecoder(properties(ClerkTestTokens.publicKeyPem()), cors, clock);
        Instant now = Instant.now();

        for (String token : List.of(
                ClerkTestTokens.token("user_1", "https://www.hackademy.app", Map.of()),
                ClerkTestTokens.token("user_1", ORIGIN, Map.of("sts", "pending")),
                ClerkTestTokens.sign(ClerkTestTokens.keys(), ClerkTestTokens.builder("user_1", ORIGIN, now, now.plusSeconds(60), Map.of())
                        .issuer("https://other.clerk.accounts.dev").build()),
                ClerkTestTokens.sign(ClerkTestTokens.keys(), ClerkTestTokens.builder("user_1", ORIGIN, now.minusSeconds(200),
                        now.minusSeconds(30), Map.of()).build()),
                ClerkTestTokens.sign(ClerkTestTokens.keys(), ClerkTestTokens.builder("user_1", ORIGIN, now.plusSeconds(120),
                        now.plusSeconds(180), Map.of()).build()))) {
            assertThrows(JwtValidationException.class, () -> decoder.decode(token));
        }
    }

    @Test
    void validatorRequiresSubjectExpiryAndAuthorizedParty() {
        var validator = ClerkJwtConfig.validator(ClerkTestTokens.ISSUER, List.of(ORIGIN),
                Clock.fixed(Instant.parse("2026-10-19T12:00:00Z"), ZoneOffset.UTC));
        Instant issued = Instant.parse("2026-10-19T11:59:30Z");

        assertFalse(validator.validate(jwt(issued, issued.plusSeconds(60), Map.of("sub", "user_1", "azp", ORIGIN))).hasErrors());
        assertTrue(validator.validate(jwt(issued, issued.plusSeconds(60), Map.of("sub", " ", "azp", ORIGIN))).hasErrors());
        assertTrue(validator.validate(jwt(issued, issued.plusSeconds(60), Map.of("sub", "user_1"))).hasErrors());
        assertTrue(validator.validate(jwt(issued, null, Map.of("sub", "user_1", "azp", ORIGIN))).hasErrors());
        assertTrue(validator.validate(jwt(issued, issued.plusSeconds(60), Map.of("azp", ORIGIN))).hasErrors());
        assertTrue(validator.validate(jwt(issued, issued.plusSeconds(60), Map.of("sub", "user_1", "azp", ORIGIN, "sid", " "))).hasErrors());
        assertFalse(validator.validate(jwt(issued, issued.plusSeconds(60),
                Map.of("sub", "user_1", "azp", ORIGIN, "sts", "active"))).hasErrors());
    }

    private static Jwt jwt(Instant issuedAt, Instant expiresAt, Map<String, Object> claims) {
        var builder = Jwt.withTokenValue("token").header("alg", "RS256")
                .issuer(ClerkTestTokens.ISSUER).issuedAt(issuedAt).notBefore(issuedAt).claim("sid", "sess_test");
        if (expiresAt != null) builder.expiresAt(expiresAt);
        claims.forEach(builder::claim);
        return builder.build();
    }

    private static ClerkProperties properties(String pem) {
        return new ClerkProperties(ClerkTestTokens.ISSUER, pem, null, null);
    }
}
