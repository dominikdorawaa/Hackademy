package com.hackademy.server.user.dto;

import com.hackademy.server.user.TourStatus;
import jakarta.validation.constraints.NotNull;

public record TourRequest(@NotNull TourStatus status) {}
