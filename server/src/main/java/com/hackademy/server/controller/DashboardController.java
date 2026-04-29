package com.hackademy.server.controller;

import com.hackademy.server.dto.DashboardSummaryDto;
import com.hackademy.server.dto.PathProgressDto;
import com.hackademy.server.dto.PathSummaryDto;
import com.hackademy.server.model.User;
import com.hackademy.server.model.FriendshipStatus;
import com.hackademy.server.repository.FriendshipRepository;
import com.hackademy.server.repository.UserBadgeRepository;
import com.hackademy.server.service.PathService;
import com.hackademy.server.service.UserService;
import com.hackademy.server.service.UserServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.core.task.TaskExecutor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final UserService userService;
    private final UserServiceImpl userServiceImpl;
    private final PathService pathService;
    private final FriendshipRepository friendshipRepository;
    private final UserBadgeRepository userBadgeRepository;
    private final TaskExecutor dashboardTaskExecutor;

    private static final long CACHE_MS = 30_000; // 30 seconds
    private static final class CacheEntry<T> {
        final long timeMs;
        final T value;
        CacheEntry(long timeMs, T value) { this.timeMs = timeMs; this.value = value; }
    }
    private final ConcurrentHashMap<Long, CacheEntry<DashboardSummaryDto>> summaryCache = new ConcurrentHashMap<>();

    @GetMapping("/summary")
    public ResponseEntity<DashboardSummaryDto> getSummary() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof User user)) {
            return ResponseEntity.status(401).build();
        }

        String username = user.getUsername();
        Long userId = user.getId();

        long now = System.currentTimeMillis();
        CacheEntry<DashboardSummaryDto> cached = summaryCache.get(userId);
        if (cached != null && now - cached.timeMs <= CACHE_MS) {
            return ResponseEntity.ok(cached.value);
        }

        int effectiveStreak = user.getStreak();
        LocalDate lastSolved = user.getLastSolvedDate();
        LocalDate today = LocalDate.now();
        if (lastSolved != null && lastSolved.isBefore(today.minusDays(1))) {
            effectiveStreak = 0;
        }

        boolean hasVpnAccess = userService.hasSolvedTutorialVpn(userId);
        Map<String, Object> userInfo = Map.of(
                "id", userId,
                "username", user.getUsername(),
                "email", user.getEmail(),
                "role", user.getRole(),
                "points", user.getPoints(),
                "streak", effectiveStreak,
                "bio", user.getBio() != null ? user.getBio() : "",
                "createdAt", user.getCreatedAt(),
                "hasVpnAccess", hasVpnAccess
        );

        CompletableFuture<?> myRankF = CompletableFuture.supplyAsync(
                () -> userServiceImpl.getUserRankFast(userId, username, user.getPoints(), user.getElo()),
                dashboardTaskExecutor
        );
        CompletableFuture<?> rankingF = CompletableFuture.supplyAsync(userService::getTop10Ranking, dashboardTaskExecutor);
        CompletableFuture<?> recentSolvedF = CompletableFuture.supplyAsync(() -> userService.getRecentSolvedRooms(userId, 3), dashboardTaskExecutor);
        CompletableFuture<?> activeSecondsF = CompletableFuture.supplyAsync(() -> userService.getActiveSecondsThisWeek(userId), dashboardTaskExecutor);
        CompletableFuture<?> badgesCountF = CompletableFuture.supplyAsync(() -> (int) userBadgeRepository.countByUser_Id(userId), dashboardTaskExecutor);
        CompletableFuture<?> friendsCountF = CompletableFuture.supplyAsync(() -> (int) friendshipRepository.countByUserIdAndStatus(userId, FriendshipStatus.ACCEPTED), dashboardTaskExecutor);
        CompletableFuture<?> progressF = CompletableFuture.supplyAsync(() -> pathService.getMyPathsProgress(username), dashboardTaskExecutor);
        CompletableFuture<?> allPathsF = CompletableFuture.supplyAsync(() -> pathService.listPaths(username), dashboardTaskExecutor);

        @SuppressWarnings("unchecked")
        List<PathProgressDto> progress = (List<PathProgressDto>) progressF.join();
        PathProgressDto currentPath = progress.stream().filter(p -> !p.isCompleted()).findFirst()
                .orElse(progress.isEmpty() ? null : progress.get(0));

        CompletableFuture<?> roomsMiniF = CompletableFuture.supplyAsync(() -> {
            if (currentPath == null || currentPath.getId() == null) return List.of();
            return pathService.getPathRoomsMini(currentPath.getId(), username, 5).getRooms();
        }, dashboardTaskExecutor);

        @SuppressWarnings("unchecked")
        List<PathSummaryDto> allPaths = (List<PathSummaryDto>) allPathsF.join();
        PathSummaryDto recommended = null;
        if (allPaths != null && !allPaths.isEmpty()) {
            int idx = ThreadLocalRandom.current().nextInt(allPaths.size());
            recommended = allPaths.get(idx);
        }

        DashboardSummaryDto out = DashboardSummaryDto.builder()
                .user(userInfo)
                .myRank((com.hackademy.server.dto.RankingEntry) myRankF.join())
                .ranking((List<com.hackademy.server.dto.RankingEntry>) rankingF.join())
                .recentSolved((List<com.hackademy.server.dto.RecentSolvedRoomDto>) recentSolvedF.join())
                .activeSecondsThisWeek((Integer) activeSecondsF.join())
                .badgesEarnedCount((Integer) badgesCountF.join())
                .friendsCount((Integer) friendsCountF.join())
                .recommendedPath(recommended)
                .pathsProgress(progress)
                .currentPath(currentPath)
                .currentPathRoomsMini((List<com.hackademy.server.dto.PathRoomMiniDto>) roomsMiniF.join())
                .build();

        summaryCache.put(userId, new CacheEntry<>(now, out));
        return ResponseEntity.ok(out);
    }
}

