package com.hackademy.server.dashboard;

import com.hackademy.server.path.dto.PathRoomMiniDto;

import com.hackademy.server.path.dto.PathProgressDto;
import com.hackademy.server.path.dto.PathSummaryDto;
import com.hackademy.server.user.User;
import com.hackademy.server.path.PathService;
import com.hackademy.server.user.UserService;
import com.hackademy.server.user.UserServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

@org.springframework.stereotype.Service
@RequiredArgsConstructor
public class DashboardSummaryReader {

    private final UserService userService;
    private final UserServiceImpl userServiceImpl;
    private final PathService pathService;
    private final DashboardMetrics dashboardMetrics;

    @Transactional(readOnly = true)
    public DashboardSummaryDto read(User user) {
        String username = user.getUsername();
        Long userId = user.getId();

        int effectiveStreak = user.getStreak();
        LocalDate lastSolved = user.getLastSolvedDate();
        LocalDate today = LocalDate.now();
        if (lastSolved != null && lastSolved.isBefore(today.minusDays(1))) {
            effectiveStreak = 0;
        }

        DashboardMetrics.Counts counts = dashboardMetrics.read(userId);
        boolean hasVpnAccess = counts.vpn();
        Map<String, Object> userInfo = new java.util.LinkedHashMap<>(Map.of(
                "id", userId,
                "username", user.getUsername(),
                "email", user.getEmail(),
                "role", user.getRole(),
                "points", user.getPoints(),
                "streak", effectiveStreak,
                "bio", user.getBio() != null ? user.getBio() : "",
                "createdAt", user.getCreatedAt(),
                "hasVpnAccess", hasVpnAccess
        ));
        userInfo.put("avatar", userService.getAvatar(userId));

        List<PathProgressDto> progress = pathService.getMyPathsProgress(username);
        PathProgressDto currentPath = progress.stream().filter(p -> !p.completed()).findFirst()
                .orElse(progress.isEmpty() ? null : progress.get(0));

        List<PathRoomMiniDto> roomsMini = currentPath == null || currentPath.id() == null ? List.of()
                : pathService.getPathRoomsMini(currentPath.id(), username, 0).rooms();
        List<PathSummaryDto> listed = pathService.listPaths(username);
        List<PathSummaryDto> allPaths = listed == null ? List.of() : listed.stream()
                .filter(path -> path.systemKey() == null)
                .toList();
        PathSummaryDto recommended = null;
        if (allPaths != null && !allPaths.isEmpty()) {
            int idx = ThreadLocalRandom.current().nextInt(allPaths.size());
            recommended = allPaths.get(idx);
        }

        DashboardSummaryDto out = DashboardSummaryDto.builder()
                .user(userInfo)
                .myRank(userServiceImpl.getUserRankFast(userId, username, user.getPoints(), user.getElo()))
                .ranking(userService.getTop10Ranking())
                .recentSolved(userService.getRecentSolvedRooms(userId, 20))
                .activeSecondsThisWeek(counts.seconds())
                .badgesEarnedCount(counts.badges())
                .friendsCount(counts.friends())
                .recommendedPath(recommended)
                .pathsProgress(progress)
                .currentPath(currentPath)
                .currentPathRoomsMini(roomsMini)
                .build();

        return out;
    }
}

