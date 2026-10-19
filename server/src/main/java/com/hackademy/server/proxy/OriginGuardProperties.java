package com.hackademy.server.proxy;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

@ConfigurationProperties(prefix = "application.origin-guard")
public record OriginGuardProperties(List<String> secrets) {

    static final int MIN_SECRET_LENGTH = 32;
    private static final Pattern HEADER_SAFE = Pattern.compile("[\\x21-\\x7E]+");

    public OriginGuardProperties {
        Set<String> accepted = new LinkedHashSet<>();
        if (secrets != null) {
            for (String secret : secrets) {
                String value = secret == null ? "" : secret.trim();
                if (value.isEmpty()) {
                    continue;
                }
                if (value.length() < MIN_SECRET_LENGTH || !HEADER_SAFE.matcher(value).matches()) {
                    throw new IllegalArgumentException("application.origin-guard.secrets must contain only values of at least "
                            + MIN_SECRET_LENGTH + " visible ASCII characters without spaces");
                }
                accepted.add(value);
            }
        }
        secrets = List.copyOf(accepted);
    }

    public boolean enabled() {
        return !secrets.isEmpty();
    }

    @Override
    public String toString() {
        return "OriginGuardProperties[secrets=" + secrets.size() + " configured]";
    }
}
