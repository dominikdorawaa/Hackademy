package com.hackademy.server.service;

import com.hackademy.server.dto.BadgeDto;
import com.hackademy.server.model.Badge;
import com.hackademy.server.model.User;
import com.hackademy.server.model.UserBadge;
import com.hackademy.server.repository.BadgeRepository;
import com.hackademy.server.repository.UserBadgeRepository;
import com.hackademy.server.repository.UserSolvedRoomRepository;
import com.hackademy.server.repository.FriendshipRepository;
import com.hackademy.server.model.FriendshipStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BadgeServiceImpl implements BadgeService {

    private final BadgeRepository badgeRepository;
    private final UserBadgeRepository userBadgeRepository;
    private final UserSolvedRoomRepository userSolvedRoomRepository;
    private final FriendshipRepository friendshipRepository;

    @Override
    @Transactional(readOnly = true)
    public List<BadgeDto> getUserBadges(Long userId) {
        return userBadgeRepository.findByUser_Id(userId).stream()
                .map(ub -> new BadgeDto(
                        ub.getBadge().getId(),
                        ub.getBadge().getName(),
                        ub.getBadge().getDescription(),
                        ub.getBadge().getIcon(),
                        ub.getEarnedAt(),
                        true
                ))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<BadgeDto> getAllBadgesWithStatus(Long userId) {
        List<Badge> allBadges = badgeRepository.findAll();
        List<UserBadge> userBadges = userBadgeRepository.findByUser_Id(userId);
        
        Map<Long, UserBadge> earnedMap = userBadges.stream()
                .collect(Collectors.toMap(ub -> ub.getBadge().getId(), ub -> ub));

        return allBadges.stream()
                .map(badge -> {
                    UserBadge ub = earnedMap.get(badge.getId());
                    return new BadgeDto(
                            badge.getId(),
                            badge.getName(),
                            badge.getDescription(),
                            badge.getIcon(),
                            ub != null ? ub.getEarnedAt() : null,
                            ub != null
                    );
                })
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public List<BadgeDto> checkAndAwardBadges(User user) {
        List<Badge> allBadges = badgeRepository.findAll();
        List<BadgeDto> newBadges = new ArrayList<>();

        for (Badge badge : allBadges) {
            if (userBadgeRepository.existsByUser_IdAndBadge_Id(user.getId(), badge.getId())) {
                continue;
            }

            boolean earned = false;
            switch (badge.getConditionType()) {
                case "POINTS":
                    if (user.getPoints() >= badge.getConditionValue()) {
                        earned = true;
                    }
                    break;
                case "STREAK":
                    if (user.getStreak() >= badge.getConditionValue()) {
                        earned = true;
                    }
                    break;
                case "SOLVED_COUNT":
                    long solvedCount = userSolvedRoomRepository.countByUser_Id(user.getId());
                    if (solvedCount >= badge.getConditionValue()) {
                        earned = true;
                    }
                    break;
                case "FRIENDS_COUNT":
                    long friendsCount = friendshipRepository.findByUserAndStatus(user, FriendshipStatus.ACCEPTED).size();
                    if (friendsCount >= badge.getConditionValue()) {
                        earned = true;
                    }
                    break;
            }

            if (earned) {
                UserBadge userBadge = new UserBadge(user, badge);
                userBadgeRepository.save(userBadge);
                newBadges.add(new BadgeDto(
                        badge.getId(),
                        badge.getName(),
                        badge.getDescription(),
                        badge.getIcon(),
                        userBadge.getEarnedAt(),
                        true
                ));
            }
        }

        return newBadges;
    }
}
