package com.hackademy.server.database;

import org.springframework.boot.EnvironmentPostProcessor;
import org.springframework.boot.SpringApplication;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public class DatabaseUrlEnvironmentPostProcessor implements EnvironmentPostProcessor {
    static final String PROPERTY_SOURCE_NAME = "databaseUrl";

    private static final String DATABASE_URL = "DATABASE_URL";
    private static final int DEFAULT_PORT = 5432;
    private static final Set<String> SCHEMES = Set.of("postgres", "postgresql");
    private static final Set<String> WEAK_SSL_MODES = Set.of("disable", "allow", "prefer");
    private static final String SSL_MODE = "sslmode";
    private static final String REQUIRED_SSL_MODE = "require";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        var databaseUrl = environment.getProperty(DATABASE_URL);
        if (databaseUrl == null || databaseUrl.isBlank()) {
            return;
        }
        environment.getPropertySources()
                .addFirst(new MapPropertySource(PROPERTY_SOURCE_NAME, datasourceProperties(databaseUrl.strip())));
    }

    static Map<String, Object> datasourceProperties(String databaseUrl) {
        var uri = parse(databaseUrl);
        if (uri.getScheme() == null || !SCHEMES.contains(uri.getScheme().toLowerCase(Locale.ROOT))) {
            throw invalid("must use the postgres or postgresql scheme");
        }
        if (uri.getHost() == null || uri.getHost().isEmpty()) {
            throw invalid("must include a host");
        }
        var database = uri.getRawPath() == null ? "" : uri.getRawPath().replaceFirst("^/", "");
        if (database.isEmpty()) {
            throw invalid("must include a database name");
        }
        var userInfo = uri.getRawUserInfo();
        if (userInfo == null || userInfo.isEmpty()) {
            throw invalid("must include a username");
        }
        var separator = userInfo.indexOf(':');
        var username = decode(separator < 0 ? userInfo : userInfo.substring(0, separator));
        if (username.isEmpty()) {
            throw invalid("must include a username");
        }
        var password = separator < 0 ? "" : decode(userInfo.substring(separator + 1));
        var port = uri.getPort() < 0 ? DEFAULT_PORT : uri.getPort();
        var jdbcUrl = "jdbc:postgresql://" + uri.getHost() + ":" + port + "/" + database + "?" + query(uri.getRawQuery());
        return Map.of(
                "spring.datasource.url", jdbcUrl,
                "spring.datasource.username", username,
                "spring.datasource.password", password);
    }

    private static URI parse(String databaseUrl) {
        try {
            return new URI(databaseUrl);
        } catch (URISyntaxException exception) {
            throw invalid("is not a valid URL");
        }
    }

    private static String query(String rawQuery) {
        var parameters = new ArrayList<String>();
        var hasSslMode = false;
        if (rawQuery != null && !rawQuery.isEmpty()) {
            for (var parameter : rawQuery.split("&")) {
                if (parameter.isEmpty()) {
                    continue;
                }
                var separator = parameter.indexOf('=');
                var name = separator < 0 ? parameter : parameter.substring(0, separator);
                if (!SSL_MODE.equals(name)) {
                    parameters.add(parameter);
                    continue;
                }
                hasSslMode = true;
                var value = separator < 0 ? "" : parameter.substring(separator + 1);
                parameters.add(value.isEmpty() || WEAK_SSL_MODES.contains(value.toLowerCase(Locale.ROOT))
                        ? SSL_MODE + "=" + REQUIRED_SSL_MODE
                        : parameter);
            }
        }
        if (!hasSslMode) {
            parameters.add(SSL_MODE + "=" + REQUIRED_SSL_MODE);
        }
        return String.join("&", parameters);
    }

    private static String decode(String value) {
        return URLDecoder.decode(value.replace("+", "%2B"), StandardCharsets.UTF_8);
    }

    private static IllegalStateException invalid(String reason) {
        return new IllegalStateException(DATABASE_URL + " " + reason);
    }
}
