package com.hackademy.server.bugreport;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(BugReportProperties.class)
public class BugReportConfig {
}
