package com.hackademy.server.clerk;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

@ConfigurationProperties(prefix = "application.clerk")
public record ClerkProperties(String issuer, String jwtKey, String secretKey, String apiUrl) {

    public static final String DEFAULT_API_URL = "https://api.clerk.com/v1";

    public ClerkProperties {
        issuer = normalizeIssuer(issuer);
        jwtKey = blankToNull(jwtKey);
        secretKey = blankToNull(secretKey);
        apiUrl = blankToNull(apiUrl) == null ? DEFAULT_API_URL : stripTrailingSlash(apiUrl.trim());
    }

    public String jwksUri() {
        return issuer + "/.well-known/jwks.json";
    }

    private static String normalizeIssuer(String value) {
        String issuer = value == null ? "" : stripTrailingSlash(value.trim());
        URI uri;
        try {
            uri = new URI(issuer);
        } catch (URISyntaxException exception) {
            throw invalidIssuer(value);
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        boolean local = "localhost".equals(uri.getHost()) || "127.0.0.1".equals(uri.getHost());
        if (uri.getHost() == null || !(scheme.equals("https") || (scheme.equals("http") && local))
                || uri.getRawUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null
                || !(uri.getRawPath() == null || uri.getRawPath().isEmpty())) {
            throw invalidIssuer(value);
        }
        return issuer;
    }

    private static String stripTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static IllegalArgumentException invalidIssuer(String value) {
        return new IllegalArgumentException(
                "application.clerk.issuer must be the Clerk Frontend API URL, for example https://example.clerk.accounts.dev, got '"
                        + value + "'");
    }
}
