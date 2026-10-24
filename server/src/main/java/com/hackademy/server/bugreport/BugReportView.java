package com.hackademy.server.bugreport;

import java.time.LocalDateTime;

public record BugReportView(
        Long id,
        String reporterUsername,
        BugReportSource source,
        Long roomId,
        String roomTitle,
        Long taskId,
        String taskTitle,
        String gameId,
        String lessonId,
        String pagePath,
        String description,
        BugReportStatus status,
        LocalDateTime createdAt,
        LocalDateTime resolvedAt
) {
}
