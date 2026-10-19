package com.hackademy.server;

import org.springframework.boot.EnvironmentPostProcessor;
import org.springframework.boot.SpringApplication;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.util.Map;

public class ClerkTestEnvironmentPostProcessor implements EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        environment.getPropertySources().addLast(new MapPropertySource("clerkTestDefaults", Map.of(
                "CLERK_ISSUER", ClerkTestTokens.ISSUER,
                "CLERK_JWT_KEY", ClerkTestTokens.publicKeyPem())));
    }
}
