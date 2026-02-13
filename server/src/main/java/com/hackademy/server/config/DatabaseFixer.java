package com.hackademy.server.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DatabaseFixer {

    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void fixDatabase() {
        try {
            System.out.println("Attempting to manually fix database schema...");
            jdbcTemplate.execute("ALTER TABLE rooms ADD COLUMN IF NOT EXISTS requires_vpn BOOLEAN NOT NULL DEFAULT FALSE");
            System.out.println("Database schema fixed: requires_vpn column added.");
        } catch (Exception e) {
            System.err.println("Failed to fix database schema: " + e.getMessage());
            // Don't throw exception to allow app to start if column already exists or other error
        }
    }
}
