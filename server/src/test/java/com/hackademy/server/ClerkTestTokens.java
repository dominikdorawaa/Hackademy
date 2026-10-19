package com.hackademy.server;

import com.hackademy.server.user.Role;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

public final class ClerkTestTokens {

    public static final String ISSUER = "https://test-instance.clerk.accounts.dev";
    public static final String DEFAULT_ORIGIN = "http://localhost:5173";
    private static final KeyPair KEYS = generate();

    private ClerkTestTokens() {
    }

    public static String publicKeyPem() {
        String body = Base64.getMimeEncoder(64, "\n".getBytes()).encodeToString(publicKey().getEncoded());
        return "-----BEGIN PUBLIC KEY-----\n" + body + "\n-----END PUBLIC KEY-----";
    }

    public static RSAPublicKey publicKey() {
        return (RSAPublicKey) KEYS.getPublic();
    }

    public static KeyPair keys() {
        return KEYS;
    }

    public static String tokenFor(User user) {
        return tokenFor(user, DEFAULT_ORIGIN);
    }

    public static String tokenFor(User user, String origin) {
        return token(user.getClerkUserId(), origin, Map.of("email", user.getEmail(), "email_verified", true));
    }

    public static String bearer(User user) {
        return "Bearer " + tokenFor(user);
    }

    public static User createUser(UserRepository repository, String username, Role role) {
        return repository.saveAndFlush(User.builder()
                .username(username)
                .email(username.toLowerCase() + "@example.com")
                .role(role)
                .clerkUserId("user_" + UUID.randomUUID().toString().replace("-", ""))
                .build());
    }

    public static String token(String subject, String origin, Map<String, Object> claims) {
        Instant now = Instant.now();
        return sign(KEYS, builder(subject, origin, now.minusSeconds(5), now.plusSeconds(60), claims).build());
    }

    public static JWTClaimsSet.Builder builder(String subject, String origin, Instant issuedAt, Instant expiresAt,
                                               Map<String, Object> claims) {
        JWTClaimsSet.Builder builder = new JWTClaimsSet.Builder()
                .issuer(ISSUER)
                .subject(subject)
                .issueTime(Date.from(issuedAt))
                .notBeforeTime(Date.from(issuedAt))
                .expirationTime(Date.from(expiresAt))
                .claim("azp", origin)
                .claim("sid", "sess_test")
                .claim("sts", "active")
                .claim("v", 2);
        claims.forEach(builder::claim);
        return builder;
    }

    public static String sign(KeyPair keys, JWTClaimsSet claims) {
        try {
            SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("test-key").build(), claims);
            jwt.sign(new RSASSASigner(keys.getPrivate()));
            return jwt.serialize();
        } catch (JOSEException exception) {
            throw new IllegalStateException(exception);
        }
    }

    public static KeyPair generate() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            return generator.generateKeyPair();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
