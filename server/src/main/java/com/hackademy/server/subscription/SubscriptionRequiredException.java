package com.hackademy.server.subscription;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public class SubscriptionRequiredException extends ResponseStatusException {

    public static final String CODE = "SUBSCRIPTION_REQUIRED";

    public SubscriptionRequiredException(String reason) {
        super(HttpStatus.FORBIDDEN, reason);
    }
}
