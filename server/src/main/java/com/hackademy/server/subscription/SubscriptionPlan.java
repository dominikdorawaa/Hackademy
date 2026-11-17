package com.hackademy.server.subscription;

public enum SubscriptionPlan {
    MONTHLY("monthly", 30, 1000, 2999);

    public static final String CURRENCY = "PLN";

    private final String id;
    private final int days;
    private final int coins;
    private final int priceMinor;

    SubscriptionPlan(String id, int days, int coins, int priceMinor) {
        this.id = id;
        this.days = days;
        this.coins = coins;
        this.priceMinor = priceMinor;
    }

    public String id() {
        return id;
    }

    public int days() {
        return days;
    }

    public int coins() {
        return coins;
    }

    public int priceMinor() {
        return priceMinor;
    }
}
