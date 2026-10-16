package com.hackademy.server.path.dto;

import com.hackademy.server.path.PathUnlockMode;
import com.hackademy.server.room.dto.RoomSummaryDto;
import lombok.Builder;
import java.util.List;

@Builder
public record PathDetailDto(
    Long id,
    String title,
    String description,
    String bannerUrl,
    boolean hasBanner,
    boolean enrolled,
    PathUnlockMode unlockMode,
    List<RoomSummaryDto> rooms,
    List<PathChapterDto> chapters
) {}
