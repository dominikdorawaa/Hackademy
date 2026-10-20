package com.hackademy.server.proxy;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

@Configuration
@EnableConfigurationProperties(OriginGuardProperties.class)
public class OriginGuardConfig {

    private static final Logger log = LoggerFactory.getLogger(OriginGuardConfig.class);

    @Bean
    public FilterRegistrationBean<OriginGuardFilter> originGuardFilterRegistration(OriginGuardProperties properties) {
        FilterRegistrationBean<OriginGuardFilter> registration = new FilterRegistrationBean<>(new OriginGuardFilter(properties));
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        registration.addUrlPatterns("/*");
        registration.setEnabled(properties.enabled());
        if (properties.enabled()) {
            log.info("Origin guard enabled with {} accepted secret(s)", properties.secrets().size());
        } else {
            log.warn("Origin guard disabled: requests that bypass Cloudflare are accepted");
        }
        return registration;
    }
}
