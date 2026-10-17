package com.hackademy.server.database;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.Banner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.MapPropertySource;
import org.springframework.mock.env.MockEnvironment;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DatabaseUrlEnvironmentPostProcessorTest {
    private static final String PASSWORD = "fakePassword123";

    private final DatabaseUrlEnvironmentPostProcessor processor = new DatabaseUrlEnvironmentPostProcessor();

    @ParameterizedTest
    @ValueSource(strings = {"postgres", "postgresql", "POSTGRES"})
    void convertsHerokuUrlToJdbcProperties(String scheme) {
        var properties = DatabaseUrlEnvironmentPostProcessor.datasourceProperties(
                scheme + "://fakeuser:" + PASSWORD + "@db.example.com:5433/fakedb");

        assertEquals(Map.of(
                "spring.datasource.url", "jdbc:postgresql://db.example.com:5433/fakedb?sslmode=require",
                "spring.datasource.username", "fakeuser",
                "spring.datasource.password", PASSWORD), properties);
    }

    @Test
    void decodesEncodedUsernameAndPassword() {
        var properties = DatabaseUrlEnvironmentPostProcessor.datasourceProperties(
                "postgres://fake%40user:p%40ss%2Fw%3Ard+x%25@db.example.com/fakedb");

        assertEquals("fake@user", properties.get("spring.datasource.username"));
        assertEquals("p@ss/w:rd+x%", properties.get("spring.datasource.password"));
    }

    @Test
    void usesDefaultPortWhenMissing() {
        var properties = DatabaseUrlEnvironmentPostProcessor.datasourceProperties(
                "postgres://fakeuser:" + PASSWORD + "@db.example.com/fakedb");

        assertEquals("jdbc:postgresql://db.example.com:5432/fakedb?sslmode=require",
                properties.get("spring.datasource.url"));
    }

    @Test
    void keepsIpv6HostInBrackets() {
        var properties = DatabaseUrlEnvironmentPostProcessor.datasourceProperties(
                "postgres://fakeuser:" + PASSWORD + "@[2001:db8::1]:6543/fakedb");

        assertEquals("jdbc:postgresql://[2001:db8::1]:6543/fakedb?sslmode=require",
                properties.get("spring.datasource.url"));
    }

    @Test
    void acceptsUsernameWithoutPassword() {
        var properties = DatabaseUrlEnvironmentPostProcessor.datasourceProperties(
                "postgres://fakeuser@db.example.com/fakedb");

        assertEquals("fakeuser", properties.get("spring.datasource.username"));
        assertEquals("", properties.get("spring.datasource.password"));
    }

    @Test
    void keepsExistingQueryParameters() {
        var properties = DatabaseUrlEnvironmentPostProcessor.datasourceProperties(
                "postgres://fakeuser:" + PASSWORD + "@db.example.com/fakedb?connectTimeout=10&&application_name=hack%20ademy&readOnly");

        assertEquals(
                "jdbc:postgresql://db.example.com:5432/fakedb?connectTimeout=10&application_name=hack%20ademy&readOnly&sslmode=require",
                properties.get("spring.datasource.url"));
    }

    @ParameterizedTest
    @CsvSource({
            "sslmode=disable, sslmode=require",
            "sslmode=allow, sslmode=require",
            "sslmode=prefer, sslmode=require",
            "sslmode=PREFER, sslmode=require",
            "sslmode=, sslmode=require",
            "sslmode, sslmode=require",
            "sslmode=require, sslmode=require",
            "sslmode=verify-ca, sslmode=verify-ca",
            "sslmode=verify-full, sslmode=verify-full"
    })
    void enforcesSslWithoutWeakeningStricterModes(String given, String expected) {
        var properties = DatabaseUrlEnvironmentPostProcessor.datasourceProperties(
                "postgres://fakeuser:" + PASSWORD + "@db.example.com/fakedb?connectTimeout=10&" + given + "&sslrootcert=root.crt");

        assertEquals("jdbc:postgresql://db.example.com:5432/fakedb?connectTimeout=10&" + expected + "&sslrootcert=root.crt",
                properties.get("spring.datasource.url"));
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "mysql://fakeuser:fakePassword123@db.example.com/fakedb | DATABASE_URL must use the postgres or postgresql scheme",
            "db.example.com/fakePassword123 | DATABASE_URL must use the postgres or postgresql scheme",
            "postgres:fakePassword123 | DATABASE_URL must include a host",
            "postgres:///fakedb?password=fakePassword123 | DATABASE_URL must include a host",
            "postgres://fakeuser:fakePassword123@db.example.com | DATABASE_URL must include a database name",
            "postgres://fakeuser:fakePassword123@db.example.com/ | DATABASE_URL must include a database name",
            "postgres://db.example.com/fakedb?password=fakePassword123 | DATABASE_URL must include a username",
            "postgres://:fakePassword123@db.example.com/fakedb | DATABASE_URL must include a username",
            "postgres://fakeuser:fake Password123@db.example.com/fakedb | DATABASE_URL is not a valid URL"
    })
    void rejectsInvalidUrlWithoutLeakingSecrets(String databaseUrl, String message) {
        var environment = new MockEnvironment().withProperty("DATABASE_URL", databaseUrl);

        var exception = assertThrows(IllegalStateException.class,
                () -> processor.postProcessEnvironment(environment, new SpringApplication()));

        assertEquals(message, exception.getMessage());
        assertFalse(exception.getMessage().contains("Password123"));
        assertFalse(exception.getMessage().contains(databaseUrl));
        assertNull(exception.getCause());
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   "})
    void leavesEnvironmentUnchangedWithoutDatabaseUrl(String databaseUrl) {
        var environment = legacyEnvironment().withProperty("DATABASE_URL", databaseUrl);

        processor.postProcessEnvironment(environment, new SpringApplication());

        assertNull(environment.getPropertySources().get(DatabaseUrlEnvironmentPostProcessor.PROPERTY_SOURCE_NAME));
        assertEquals("jdbc:postgresql://legacy.example.com:5432/legacydb", environment.getProperty("spring.datasource.url"));
        assertEquals("legacyuser", environment.getProperty("spring.datasource.username"));
        assertEquals("legacyPassword", environment.getProperty("spring.datasource.password"));
    }

    @Test
    void leavesEnvironmentUnchangedWhenDatabaseUrlIsMissing() {
        var environment = legacyEnvironment();

        processor.postProcessEnvironment(environment, new SpringApplication());

        assertNull(environment.getPropertySources().get(DatabaseUrlEnvironmentPostProcessor.PROPERTY_SOURCE_NAME));
        assertEquals("jdbc:postgresql://legacy.example.com:5432/legacydb", environment.getProperty("spring.datasource.url"));
    }

    @Test
    void takesPrecedenceOverDatabaseVariablesAndApplicationProperties() {
        var environment = legacyEnvironment()
                .withProperty("DATABASE_URL", "  postgres://fakeuser:" + PASSWORD + "@db.example.com:5433/fakedb  ");

        processor.postProcessEnvironment(environment, new SpringApplication());

        assertEquals(DatabaseUrlEnvironmentPostProcessor.PROPERTY_SOURCE_NAME,
                environment.getPropertySources().iterator().next().getName());
        assertEquals("jdbc:postgresql://db.example.com:5433/fakedb?sslmode=require",
                environment.getProperty("spring.datasource.url"));
        assertEquals("fakeuser", environment.getProperty("spring.datasource.username"));
        assertEquals(PASSWORD, environment.getProperty("spring.datasource.password"));
    }

    @Test
    void applicationUsesDatabaseUrlOverApplicationYaml() {
        try (var context = run(Map.of(
                "DATABASE_URL", "postgresql://fakeuser:" + PASSWORD + "@db.example.com/fakedb?sslmode=disable",
                "DB_URL", "jdbc:postgresql://legacy.example.com:5432/legacydb",
                "DB_USERNAME", "legacyuser",
                "DB_PASSWORD", "legacyPassword"))) {
            var environment = context.getEnvironment();

            assertEquals("jdbc:postgresql://db.example.com:5432/fakedb?sslmode=require",
                    environment.getProperty("spring.datasource.url"));
            assertEquals("fakeuser", environment.getProperty("spring.datasource.username"));
            assertEquals(PASSWORD, environment.getProperty("spring.datasource.password"));
        }
    }

    @Test
    void applicationKeepsDatabaseVariablesWithoutDatabaseUrl() {
        try (var context = run(Map.of(
                "DB_URL", "jdbc:postgresql://legacy.example.com:5432/legacydb",
                "DB_USERNAME", "legacyuser",
                "DB_PASSWORD", "legacyPassword"))) {
            var environment = context.getEnvironment();

            assertNull(environment.getPropertySources().get(DatabaseUrlEnvironmentPostProcessor.PROPERTY_SOURCE_NAME));
            assertEquals("jdbc:postgresql://legacy.example.com:5432/legacydb", environment.getProperty("spring.datasource.url"));
            assertEquals("legacyuser", environment.getProperty("spring.datasource.username"));
            assertEquals("legacyPassword", environment.getProperty("spring.datasource.password"));
        }
    }

    private ConfigurableApplicationContext run(Map<String, Object> properties) {
        var application = new SpringApplication(EmptyApplication.class);
        application.setWebApplicationType(WebApplicationType.NONE);
        application.setBannerMode(Banner.Mode.OFF);
        application.setLogStartupInfo(false);
        application.setDefaultProperties(properties);
        return application.run();
    }

    static class EmptyApplication {
    }

    private MockEnvironment legacyEnvironment() {
        var environment = new MockEnvironment()
                .withProperty("DB_URL", "jdbc:postgresql://legacy.example.com:5432/legacydb")
                .withProperty("DB_USERNAME", "legacyuser")
                .withProperty("DB_PASSWORD", "legacyPassword");
        environment.getPropertySources().addLast(new MapPropertySource("application", Map.of(
                "spring.datasource.url", "${DB_URL}",
                "spring.datasource.username", "${DB_USERNAME}",
                "spring.datasource.password", "${DB_PASSWORD}")));
        return environment;
    }
}
