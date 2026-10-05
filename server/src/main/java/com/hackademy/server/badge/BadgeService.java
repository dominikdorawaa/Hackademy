package com.hackademy.server.badge;

import com.hackademy.server.user.User;

import java.util.List;

public interface BadgeService {
    List<BadgeDto> getUserBadges(Long userId);
    List<BadgeDto> getAllBadgesWithStatus(Long userId);
    List<BadgeDto> checkAndAwardBadges(User user);
}
