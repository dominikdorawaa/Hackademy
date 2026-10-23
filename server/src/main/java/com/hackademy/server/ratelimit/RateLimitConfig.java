package com.hackademy.server.ratelimit;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jwt.JwtDecoder;

import java.time.Clock;

@Configuration
@EnableConfigurationProperties(RateLimitProperties.class)
public class RateLimitConfig {

    @Bean
    public RateLimiter rateLimiter(RateLimitProperties properties, Clock clock) {
        return new RateLimiter(clock, properties.maxKeys());
    }

    @Bean
    public RateLimitFilter rateLimitFilter(RateLimitProperties properties, RateLimiter rateLimiter, JwtDecoder clerkJwtDecoder) {
        return new RateLimitFilter(properties, rateLimiter, clerkJwtDecoder);
    }

    @Bean
    public FilterRegistrationBean<RateLimitFilter> rateLimitFilterRegistration(RateLimitFilter rateLimitFilter) {
        FilterRegistrationBean<RateLimitFilter> registration = new FilterRegistrationBean<>(rateLimitFilter);
        registration.setEnabled(false);
        return registration;
    }
}
