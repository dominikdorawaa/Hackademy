package com.hackademy.server.path.dto;

import java.util.List;

public record PathChapterAdminDto(
    Long id,
    String title,
    List<Long> roomIds
) {}
