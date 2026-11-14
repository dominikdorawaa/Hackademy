package com.hackademy.server.shop.dto;

import java.util.List;

public record WalletAdminDto(long userId, String username, long balance, List<WalletTransactionDto> transactions) {}
