package com.hackademy.server.subscription.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SubscriptionOrderRequest(@NotBlank @Size(max = 16) String planId) {}
