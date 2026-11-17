package com.hackademy.server.subscription.dto;

public record SubscriptionOrderDto(long id, String planId, int days, int coins, int priceMinor, String currency, String status, String redirectUrl, boolean test) {}
