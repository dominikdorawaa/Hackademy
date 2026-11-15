package com.hackademy.server.shop.dto;

import com.hackademy.server.shop.ShopCategory;

import java.util.List;

public record ShopDto(long balance, List<Item> items, List<Pack> packages, String topUps) {

    public record Item(String id, ShopCategory category, String reference, int price, boolean owned) {}

    public record Pack(String id, int coins, int priceMinor, String currency) {}
}
