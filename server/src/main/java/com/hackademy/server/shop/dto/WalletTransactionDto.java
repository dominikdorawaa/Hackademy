package com.hackademy.server.shop.dto;

import com.hackademy.server.shop.WalletTransactionKind;

import java.time.LocalDateTime;

public record WalletTransactionDto(long id, long amount, long balanceAfter, WalletTransactionKind kind, String itemId, Long orderId,
                                   String reason, String adminUsername, LocalDateTime createdAt) {}
