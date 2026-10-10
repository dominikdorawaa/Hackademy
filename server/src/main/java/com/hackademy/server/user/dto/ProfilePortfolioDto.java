package com.hackademy.server.user.dto;

import java.util.List;

public record ProfilePortfolioDto(List<PracticeArea> practiceAreas, List<CompletedPath> completedPaths) {
    public record PracticeArea(String category, long solvedRooms) {}
    public record CompletedPath(Long id, String title, int roomsCount) {}
}
