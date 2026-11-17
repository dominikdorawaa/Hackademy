package com.hackademy.server.subscription.dto;

import java.time.LocalDateTime;

public record SubscriptionDto(boolean active, boolean staff, LocalDateTime activeUntil, Plan plan, String payments, Arena arena) {

    public record Plan(String id, int days, int coins, int priceMinor, String currency) {}

    public record Arena(int dailyLimit, int playedToday, Integer remaining) {}
}
