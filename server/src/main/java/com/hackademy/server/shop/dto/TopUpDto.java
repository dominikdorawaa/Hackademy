package com.hackademy.server.shop.dto;

public record TopUpDto(long id, String packageId, int coins, int priceMinor, String currency, String status, String redirectUrl, boolean test) {}
