package com.hackademy.server.repository;

import com.hackademy.server.model.DifficultyLevel;

import java.time.LocalDateTime;

public interface RecentSolvedRoomView {
    Long getRoomId();
    String getTitle();
    DifficultyLevel getDifficulty();
    Integer getPoints();
    LocalDateTime getSolvedAt();
}

