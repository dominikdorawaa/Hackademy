package com.hackademy.server.badge;

import com.hackademy.server.dashboard.DashboardSummaryCache;

import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import com.hackademy.server.room.UserSolvedRoomRepository;
import com.hackademy.server.friendship.FriendshipRepository;
import com.hackademy.server.friendship.FriendshipStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BadgeServiceImpl implements BadgeService {

    private final BadgeRepository badgeRepository;
    private final UserBadgeRepository userBadgeRepository;
    private final UserSolvedRoomRepository userSolvedRoomRepository;
    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;
    private final DashboardSummaryCache dashboardSummaryCache;
    private final Clock clock;

    private record Catalog(List<Badge> badges, Map<Long, Long> counts, long totalUsers) {}
    private final com.github.benmanes.caffeine.cache.Cache<Integer, Catalog> catalog =
            com.hackademy.server.cache.LocalCaches.bounded(1, java.time.Duration.ofSeconds(30));

    private void invalidateCache() { catalog.invalidateAll(); }

    private Catalog catalog() {
        return catalog.get(0, key -> new Catalog(List.copyOf(badgeRepository.findAll()),
                Map.copyOf(getBadgeCountsMap()), Math.max(1, userRepository.count())));
    }

    @Override
    @Transactional(readOnly = true)
    public List<BadgeDto> getUserBadges(Long userId) {
        return getAllBadgesWithStatus(userId).stream().filter(BadgeDto::earned).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<BadgeDto> getAllBadgesWithStatus(Long userId) {
        var snapshot = catalog();
        List<Badge> allBadges = snapshot.badges();
        List<UserBadgeRepository.EarnedBadgeRow> earnedRows = userBadgeRepository.findEarnedBadgeRowsByUserId(userId);

        Map<Long, UserBadgeRepository.EarnedBadgeRow> earnedMap = earnedRows.stream()
                .collect(Collectors.toMap(UserBadgeRepository.EarnedBadgeRow::getBadgeId, r -> r));

        long totalUsers = snapshot.totalUsers();
        Map<Long, Long> badgeCounts = snapshot.counts();

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new com.hackademy.server.exception.UserNotFoundException("User not found"));
        Map<String, Long> currentValues = Map.of(
                "POINTS", (long) user.getPoints(),
                "STREAK", effectiveStreak(user),
                "SOLVED_COUNT", userSolvedRoomRepository.countByUser_Id(userId),
                "FRIENDS_COUNT", friendshipRepository.countByUserIdAndStatus(userId, FriendshipStatus.ACCEPTED));

        long finalTotalUsers = totalUsers;
        return allBadges.stream()
                .map(badge -> {
                    UserBadgeRepository.EarnedBadgeRow ub = earnedMap.get(badge.getId());
                    long count = badgeCounts.getOrDefault(badge.getId(), 0L);
                    double rarity = ((double) count / finalTotalUsers) * 100.0;
                    
                    return new BadgeDto(
                            badge.getId(),
                            badge.getName(),
                            badge.getDescription(),
                            badge.getIcon(),
                            ub != null ? ub.getEarnedAt() : null,
                            ub != null,
                            rarity,
                            progressFor(badge, ub != null, currentValues)
                    );
                })
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public List<BadgeDto> checkAndAwardBadges(User user) {
        List<Badge> allBadges = badgeRepository.findAll();
        List<BadgeDto> newBadges = new ArrayList<>();
        long totalUsers = userRepository.count();
        if (totalUsers == 0) totalUsers = 1;

        Map<Long, Long> badgeCounts = getBadgeCountsMap();

        var earnedIds = userBadgeRepository.findEarnedBadgeRowsByUserId(user.getId()).stream()
                .map(UserBadgeRepository.EarnedBadgeRow::getBadgeId).collect(Collectors.toSet());
        long solvedCount = userSolvedRoomRepository.countByUser_Id(user.getId());
        long friendsCount = friendshipRepository.countByUserIdAndStatus(user.getId(), FriendshipStatus.ACCEPTED);
        for (Badge badge : allBadges) {
            if (earnedIds.contains(badge.getId())) {
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
                    if (effectiveStreak(user) >= badge.getConditionValue()) {
                        earned = true;
                    }
                    break;
                case "SOLVED_COUNT":
                    if (solvedCount >= badge.getConditionValue()) {
                        earned = true;
                    }
                    break;
                case "FRIENDS_COUNT":
                    if (friendsCount >= badge.getConditionValue()) {
                        earned = true;
                    }
                    break;
            }

            if (earned) {
                UserBadge userBadge = new UserBadge(user, badge);
                userBadgeRepository.save(userBadge);
                
                long count = badgeCounts.getOrDefault(badge.getId(), 0L);
                double rarity = ((double) (count + 1) / totalUsers) * 100.0;

                newBadges.add(new BadgeDto(
                        badge.getId(),
                        badge.getName(),
                        badge.getDescription(),
                        badge.getIcon(),
                        userBadge.getEarnedAt(),
                        true,
                        rarity
                ));
            }
        }

        if (!newBadges.isEmpty()) {
            invalidateCache();
            dashboardSummaryCache.invalidateUser(user.getId());
        }
        return newBadges;
    }

    private long effectiveStreak(User user) {
        LocalDate lastSolved = user.getLastSolvedDate();
        if (lastSolved != null && lastSolved.isBefore(LocalDate.now(clock).minusDays(1))) {
            return 0;
        }
        return user.getStreak();
    }

    private BadgeProgressDto progressFor(Badge badge, boolean earned, Map<String, Long> currentValues) {
        Long current = currentValues.get(badge.getConditionType());
        if (current == null) return null;
        long target = Math.max(0, badge.getConditionValue());
        return new BadgeProgressDto(earned ? target : Math.max(0, Math.min(current, target)),
                target, badge.getConditionType());
    }

    private Map<Long, Long> getBadgeCountsMap() {
        List<Object[]> results = userBadgeRepository.countAllBadges();
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] result : results) {
            Long badgeId = (Long) result[0];
            Long count = (Long) result[1];
            counts.put(badgeId, count);
        }
        return counts;
    }
}
