package com.hackademy.server.cors;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@ConfigurationProperties(prefix = "application.cors")
public record CorsProperties(List<String> allowedOrigins) {

    private static final Set<String> SCHEMES = Set.of("http", "https");

    public CorsProperties {
        if (allowedOrigins == null || allowedOrigins.isEmpty()) {
            throw new IllegalArgumentException("application.cors.allowed-origins must list at least one origin");
        }
        Set<String> origins = new LinkedHashSet<>();
        for (String origin : allowedOrigins) {
            origins.add(normalize(origin));
        }
        allowedOrigins = List.copyOf(origins);
    }

    private static String normalize(String value) {
        String origin = value == null ? "" : value.trim();
        if (origin.isEmpty() || origin.contains("*")) {
            throw invalid(value);
        }
        URI uri;
        try {
            uri = new URI(origin);
        } catch (URISyntaxException exception) {
            throw invalid(value);
        }
        String scheme = uri.getScheme() == null ? null : uri.getScheme().toLowerCase(Locale.ROOT);
        String path = uri.getRawPath();
        if (scheme == null || !SCHEMES.contains(scheme) || uri.getHost() == null || uri.getRawUserInfo() != null
                || uri.getRawQuery() != null || uri.getRawFragment() != null
                || !(path == null || path.isEmpty() || path.equals("/"))) {
            throw invalid(value);
        }
        String host = uri.getHost().toLowerCase(Locale.ROOT);
        int port = uri.getPort();
        boolean defaultPort = port == -1 || (scheme.equals("https") && port == 443) || (scheme.equals("http") && port == 80);
        return defaultPort ? scheme + "://" + host : scheme + "://" + host + ":" + port;
    }

    private static IllegalArgumentException invalid(String origin) {
        return new IllegalArgumentException(
                "Invalid CORS origin '" + origin + "'; use scheme://host[:port] without a path or wildcard");
    }
}
