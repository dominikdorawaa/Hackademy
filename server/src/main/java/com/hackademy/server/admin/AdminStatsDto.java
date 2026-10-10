package com.hackademy.server.admin;

import com.hackademy.server.room.RoomType;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record AdminStatsDto(
    Totals totals,
    int rangeDays,
    List<Day> timeline,
    List<Slice> solvesBySource,
    List<RecentSolve> recentSolves
) {
    public record Totals(long users, long solves, long activeThisWeek, long pendingReports) {}

    public record Day(LocalDate date, long registrations, long solves) {}

    public record Slice(String key, String label, long count) {}

    public record RecentSolve(
        String username,
        Long roomId,
        String roomTitle,
        RoomType roomType,
        String pathTitle,
        LocalDateTime solvedAt
    ) {}
}
