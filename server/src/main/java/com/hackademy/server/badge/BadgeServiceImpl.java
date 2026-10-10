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

    private static final long CACHE_MS = 30_000; // 30 seconds
    private final AtomicLong cacheTimeMs = new AtomicLong(0);
    private volatile List<Badge> cachedAllBadges = null;
    private volatile Map<Long, Long> cachedBadgeCounts = null;
    private volatile long cachedTotalUsers = 0;

    private void invalidateCache() {
        cacheTimeMs.set(0);
        cachedAllBadges = null;
        cachedBadgeCounts = null;
        cachedTotalUsers = 0;
    }

    private void ensureCache() {
        long now = System.currentTimeMillis();
        if (cachedAllBadges != null && cachedBadgeCounts != null && now - cacheTimeMs.get() <= CACHE_MS) {
            return;
        }
        synchronized (this) {
            now = System.currentTimeMillis();
            if (cachedAllBadges != null && cachedBadgeCounts != null && now - cacheTimeMs.get() <= CACHE_MS) {
                return;
            }
            cachedAllBadges = badgeRepository.findAll();
            cachedBadgeCounts = getBadgeCountsMap();
            long total = userRepository.count();
            cachedTotalUsers = total == 0 ? 1 : total;
            cacheTimeMs.set(now);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<BadgeDto> getUserBadges(Long userId) {
        return getAllBadgesWithStatus(userId).stream().filter(BadgeDto::earned).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<BadgeDto> getAllBadgesWithStatus(Long userId) {
        ensureCache();
        List<Badge> allBadges = cachedAllBadges;
        List<UserBadgeRepository.EarnedBadgeRow> earnedRows = userBadgeRepository.findEarnedBadgeRowsByUserId(userId);

        Map<Long, UserBadgeRepository.EarnedBadgeRow> earnedMap = earnedRows.stream()
                .collect(Collectors.toMap(UserBadgeRepository.EarnedBadgeRow::getBadgeId, r -> r));

        long totalUsers = cachedTotalUsers;
        Map<Long, Long> badgeCounts = cachedBadgeCounts;

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new com.hackademy.server.exception.UserNotFoundException("User not found"));
        long streak = user.getStreak();
        if (user.getLastSolvedDate() != null && user.getLastSolvedDate().isBefore(java.time.LocalDate.now().minusDays(1))) {
            streak = 0;
        }
        Map<String, Long> currentValues = Map.of(
                "POINTS", (long) user.getPoints(),
                "STREAK", streak,
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
        // This mutates user_badges, so invalidate caches after awarding.
        List<Badge> allBadges = badgeRepository.findAll();
        List<BadgeDto> newBadges = new ArrayList<>();
        long totalUsers = userRepository.count();
        if (totalUsers == 0) totalUsers = 1;

        // Fetch counts once
        Map<Long, Long> badgeCounts = getBadgeCountsMap();

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
                
                long count = badgeCounts.getOrDefault(badge.getId(), 0L);
                // Add +1 for the current user who just earned it
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
