package com.hackademy.server.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardSummaryDto {
    private Map<String, Object> user;
    private RankingEntry myRank;
    private List<RankingEntry> ranking;
    private List<RecentSolvedRoomDto> recentSolved;
    private int activeSecondsThisWeek;
    private int badgesEarnedCount;
    private int friendsCount;
    private PathSummaryDto recommendedPath;
    private List<PathProgressDto> pathsProgress;
    private PathProgressDto currentPath;
    private List<PathRoomMiniDto> currentPathRoomsMini;
}

