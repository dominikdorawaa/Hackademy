package com.hackademy.server.room.dto;

import java.util.List;

public record RoomTasksAdminDto(long revision, List<RoomTaskAdminDto> tasks) {}
