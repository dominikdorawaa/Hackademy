package com.hackademy.server.shop;

import java.util.Arrays;
import java.util.Optional;

public enum ShopItem {
    DANCE_SCUBA("dance-scuba", ShopCategory.DANCE, "scuba", 400),
    CHAT_REMATCH("chat-rematch", ShopCategory.QUICK_CHAT, "rematch", 150),
    CHAT_CLOSE("chat-close", ShopCategory.QUICK_CHAT, "close", 150),
    CHAT_ROOT("chat-root", ShopCategory.QUICK_CHAT, "root", 150),
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
