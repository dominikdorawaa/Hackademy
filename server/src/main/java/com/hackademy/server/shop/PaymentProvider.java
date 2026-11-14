package com.hackademy.server.shop;

public interface PaymentProvider {

    String name();

    boolean test();

    PaymentCheckout start(long orderId, long userId, CoinPackage pack);

    record PaymentCheckout(String reference, String redirectUrl) {}
}
