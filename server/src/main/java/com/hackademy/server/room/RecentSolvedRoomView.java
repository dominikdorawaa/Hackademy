package com.hackademy.server.room;


import java.time.LocalDateTime;

public interface RecentSolvedRoomView {
    Long getRoomId();
    String getTitle();
    DifficultyLevel getDifficulty();
    Integer getPoints();
    LocalDateTime getSolvedAt();
}

