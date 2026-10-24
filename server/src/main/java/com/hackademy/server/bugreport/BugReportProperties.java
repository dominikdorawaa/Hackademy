package com.hackademy.server.bugreport;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "application.bug-reports")
public record BugReportProperties(int hourlyLimit, int dailyLimit) {

    public BugReportProperties {
        if (hourlyLimit < 1 || dailyLimit < hourlyLimit) {
            throw new IllegalArgumentException("application.bug-reports needs a positive hourly limit and a daily limit not below it");
        }
    }
}
