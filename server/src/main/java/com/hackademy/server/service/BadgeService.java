package com.hackademy.server.service;

import com.hackademy.server.dto.BadgeDto;
import com.hackademy.server.model.User;

import java.util.List;

public interface BadgeService {
    List<BadgeDto> getUserBadges(Long userId);
    List<BadgeDto> getAllBadgesWithStatus(Long userId);
    List<BadgeDto> checkAndAwardBadges(User user);
}
