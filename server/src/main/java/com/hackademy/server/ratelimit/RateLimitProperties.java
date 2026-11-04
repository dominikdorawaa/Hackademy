package com.hackademy.server.ratelimit;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "application.rate-limit")
public record RateLimitProperties(boolean enabled, int maxKeys, Rules rules) {

    public RateLimitProperties {
        if (maxKeys < 1) {
            throw new IllegalArgumentException("application.rate-limit.max-keys must be positive");
        }
        if (rules == null) {
            throw new IllegalArgumentException("application.rate-limit.rules must be configured");
        }
    }

    public Rule rule(RateLimitGroup group) {
        return switch (group) {
            case API_READ -> rules.apiRead();
            case API_WRITE -> rules.apiWrite();
            case BUG_REPORT -> rules.bugReport();
            case ANONYMOUS -> rules.anonymous();
            case PUBLIC_BANNER -> rules.publicBanner();
            case WEBSOCKET_HANDSHAKE -> rules.websocketHandshake();
            case WEBSOCKET_TRANSPORT -> rules.websocketTransport();
        };
    }

    public record Rules(Rule apiRead, Rule apiWrite, Rule anonymous, Rule publicBanner, Rule websocketHandshake,
                        Rule websocketTransport, Rule bugReport, Rule roomAnswer) {

        public Rules {
            if (apiRead == null || apiWrite == null || anonymous == null || publicBanner == null || websocketHandshake == null
                    || websocketTransport == null || bugReport == null || roomAnswer == null) {
                throw new IllegalArgumentException("application.rate-limit.rules must define every group");
            }
        }
    }

    public record Rule(int burst, int limit, Duration window) {

        public Rule {
            if (burst < 1 || limit < 1 || window == null || window.toMillis() < 1) {
                throw new IllegalArgumentException("Rate limit rules need a positive burst, limit and window");
            }
        }

        double tokensPerMilli() {
            return (double) limit / window.toMillis();
        }
    }
}
