package com.hackademy.server.bugreport;

public record BugReportRequest(BugReportSource source, Long roomId, Long taskId, String gameId, String pagePath, String description) {
}
