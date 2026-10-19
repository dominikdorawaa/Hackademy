package com.hackademy.server.user.dto;

import com.hackademy.server.user.TourStatus;

public record OnboardingDto(boolean avatarConfirmed, TourStatus tourStatus) {}
