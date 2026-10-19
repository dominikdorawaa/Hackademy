package com.hackademy.server.clerk;

import com.hackademy.server.cors.CorsProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

import java.security.KeyFactory;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Set;

@Configuration
@EnableConfigurationProperties(ClerkProperties.class)
public class ClerkJwtConfig {

    static final Duration CLOCK_SKEW = Duration.ofSeconds(10);
    static final String ACTIVE_SESSION = "active";

    @Bean
    public JwtDecoder clerkJwtDecoder(ClerkProperties properties, CorsProperties corsProperties, Clock clock) {
        NimbusJwtDecoder decoder = properties.jwtKey() == null
                ? NimbusJwtDecoder.withJwkSetUri(properties.jwksUri()).jwsAlgorithm(SignatureAlgorithm.RS256).build()
                : NimbusJwtDecoder.withPublicKey(parsePublicKey(properties.jwtKey()))
                        .signatureAlgorithm(SignatureAlgorithm.RS256).build();
        decoder.setJwtValidator(validator(properties.issuer(), corsProperties.allowedOrigins(), clock));
        return decoder;
    }

    static OAuth2TokenValidator<Jwt> validator(String issuer, List<String> authorizedParties, Clock clock) {
        JwtTimestampValidator timestamps = new JwtTimestampValidator(CLOCK_SKEW);
        timestamps.setClock(clock);
        return new DelegatingOAuth2TokenValidator<>(List.of(
                timestamps,
                new JwtIssuerValidator(issuer),
                requireExpiry(),
                requireSubject(),
                requireSession(),
                authorizedParty(Set.copyOf(authorizedParties)),
                activeSession()));
    }

    static OAuth2TokenValidator<Jwt> requireExpiry() {
        return jwt -> jwt.getExpiresAt() == null ? failure("Token has no expiry") : OAuth2TokenValidatorResult.success();
    }

    static OAuth2TokenValidator<Jwt> requireSubject() {
        return jwt -> jwt.getSubject() == null || jwt.getSubject().isBlank()
                ? failure("Token has no subject")
                : OAuth2TokenValidatorResult.success();
    }

    static OAuth2TokenValidator<Jwt> requireSession() {
        return jwt -> jwt.getClaims().get("sid") instanceof String id && !id.isBlank()
                ? OAuth2TokenValidatorResult.success() : failure("Token is not a session token");
    }

    static OAuth2TokenValidator<Jwt> authorizedParty(Set<String> allowed) {
        return jwt -> {
            String party = jwt.getClaimAsString("azp");
            return party != null && allowed.contains(party)
                    ? OAuth2TokenValidatorResult.success()
                    : failure("Token was issued for an origin that is not allowed");
        };
    }

    static OAuth2TokenValidator<Jwt> activeSession() {
        return jwt -> {
            String status = jwt.getClaimAsString("sts");
            return status == null || ACTIVE_SESSION.equals(status)
                    ? OAuth2TokenValidatorResult.success()
                    : failure("Session is not active");
        };
    }

    static RSAPublicKey parsePublicKey(String pem) {
        String body = pem.replace("\\n", "\n")
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replaceAll("\\s", "");
        try {
            byte[] der = Base64.getDecoder().decode(body);
            return (RSAPublicKey) KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(der));
        } catch (Exception exception) {
            throw new IllegalArgumentException("application.clerk.jwt-key must be an RSA public key in PEM format", exception);
        }
    }

    private static OAuth2TokenValidatorResult failure(String description) {
        return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", description, null));
    }
}
