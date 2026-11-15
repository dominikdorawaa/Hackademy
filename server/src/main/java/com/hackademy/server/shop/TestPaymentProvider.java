package com.hackademy.server.shop;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@ConditionalOnProperty(prefix = "application.shop", name = "test-payments", havingValue = "true")
public class TestPaymentProvider implements PaymentProvider {

    public static final String NAME = "test";

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public boolean test() {
        return true;
    }

    @Override
    public PaymentCheckout start(long orderId, long userId, CoinPackage pack) {
        return new PaymentCheckout("test-" + orderId + "-" + UUID.randomUUID(), null);
    }
}
