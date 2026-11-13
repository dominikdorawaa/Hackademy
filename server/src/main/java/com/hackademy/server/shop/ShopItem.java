package com.hackademy.server.shop;

import java.util.Arrays;
import java.util.Optional;

public enum ShopItem {
    DANCE_SCUBA("dance-scuba", ShopCategory.DANCE, "scuba", 400),
    DANCE_CRAB("dance-crab", ShopCategory.DANCE, "crab", 500),
    OUTFIT_COAT("outfit-coat", ShopCategory.OUTFIT, "plaszcz", 800),
    CHAT_WP("chat-wp", ShopCategory.QUICK_CHAT, "wp", 150),
    CHAT_NT("chat-nt", ShopCategory.QUICK_CHAT, "nt", 150),
    CHAT_RIP("chat-rip", ShopCategory.QUICK_CHAT, "rip", 150),
    CHAT_GLHF("chat-glhf", ShopCategory.QUICK_CHAT, "glhf", 150);

    private final String id;
    private final ShopCategory category;
    private final String reference;
    private final int price;

    ShopItem(String id, ShopCategory category, String reference, int price) {
        this.id = id;
        this.category = category;
        this.reference = reference;
        this.price = price;
    }

    public String id() {
        return id;
    }

    public ShopCategory category() {
        return category;
    }

    public String reference() {
        return reference;
    }

    public int price() {
        return price;
    }

    public static Optional<ShopItem> fromId(String id) {
        return Arrays.stream(values()).filter(item -> item.id.equals(id)).findFirst();
    }

    public static Optional<ShopItem> find(ShopCategory category, String reference) {
        return Arrays.stream(values()).filter(item -> item.category == category && item.reference.equals(reference)).findFirst();
    }

    public static Optional<ShopItem> forReaction(String reaction) {
        return find(ShopCategory.QUICK_CHAT, reaction).or(() -> find(ShopCategory.DANCE, reaction));
    }
}
