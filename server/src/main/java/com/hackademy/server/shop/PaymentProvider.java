package com.hackademy.server.shop;

public interface PaymentProvider {

    String name();

    boolean test();

    PaymentCheckout start(PaymentRequest request);

    record PaymentRequest(String kind, long orderId, long userId, int priceMinor, String currency) {}

    record PaymentCheckout(String reference, String redirectUrl) {}
}
