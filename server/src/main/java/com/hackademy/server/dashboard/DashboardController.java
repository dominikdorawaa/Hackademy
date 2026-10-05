package com.hackademy.server.dashboard;

import com.hackademy.server.path.dto.PathRoomMiniDto;
import com.hackademy.server.ranking.RankingEntry;
import com.hackademy.server.room.dto.RecentSolvedRoomDto;

import com.hackademy.server.path.dto.PathProgressDto;
import com.hackademy.server.path.dto.PathSummaryDto;
import com.hackademy.server.user.User;
import com.hackademy.server.friendship.FriendshipStatus;
import com.hackademy.server.friendship.FriendshipRepository;
import com.hackademy.server.badge.UserBadgeRepository;
import com.hackademy.server.path.PathService;
import com.hackademy.server.user.UserService;
import com.hackademy.server.user.UserServiceImpl;
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
    private final DashboardSummaryCache dashboardSummaryCache;

    @GetMapping("/summary")
    public ResponseEntity<DashboardSummaryDto> getSummary() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof User user)) {
            return ResponseEntity.status(401).build();
        }

        String username = user.getUsername();
        Long userId = user.getId();

        DashboardSummaryDto cached = dashboardSummaryCache.getIfFresh(userId);
        if (cached != null) {
            cached.setActiveSecondsThisWeek(userService.getActiveSecondsThisWeek(userId));
            return ResponseEntity.ok(cached);
        }
        long now = System.currentTimeMillis();

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
        PathProgressDto currentPath = progress.stream().filter(p -> !p.completed()).findFirst()
                .orElse(progress.isEmpty() ? null : progress.get(0));

        CompletableFuture<?> roomsMiniF = CompletableFuture.supplyAsync(() -> {
            if (currentPath == null || currentPath.id() == null) return List.of();
            return pathService.getPathRoomsMini(currentPath.id(), username, 5).rooms();
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
                .myRank((com.hackademy.server.ranking.RankingEntry) myRankF.join())
                .ranking((List<com.hackademy.server.ranking.RankingEntry>) rankingF.join())
                .recentSolved((List<com.hackademy.server.room.dto.RecentSolvedRoomDto>) recentSolvedF.join())
                .activeSecondsThisWeek((Integer) activeSecondsF.join())
                .badgesEarnedCount((Integer) badgesCountF.join())
                .friendsCount((Integer) friendsCountF.join())
                .recommendedPath(recommended)
                .pathsProgress(progress)
                .currentPath(currentPath)
                .currentPathRoomsMini((List<com.hackademy.server.path.dto.PathRoomMiniDto>) roomsMiniF.join())
                .build();

        dashboardSummaryCache.put(userId, out);
        return ResponseEntity.ok(out);
    }
}

