package com.hackademy.server.shop;

import java.util.Arrays;
import java.util.Optional;

public enum CoinPackage {
    SMALL("small", 500, 999),
    MEDIUM("medium", 1200, 1999),
    LARGE("large", 3000, 4499);

    public static final String CURRENCY = "PLN";

    private final String id;
    private final int coins;
    private final int priceMinor;

    CoinPackage(String id, int coins, int priceMinor) {
        this.id = id;
        this.coins = coins;
        this.priceMinor = priceMinor;
    }

    public String id() {
        return id;
    }

    public int coins() {
        return coins;
    }

    public int priceMinor() {
        return priceMinor;
    }

    public static Optional<CoinPackage> fromId(String id) {
        return Arrays.stream(values()).filter(item -> item.id.equals(id)).findFirst();
    }
}
