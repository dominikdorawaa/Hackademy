package com.hackademy.server.path.dto;

import com.hackademy.server.path.PathUnlockMode;
import lombok.Builder;
import java.util.List;

@Builder
public record PathAdminDetailDto(
    Long id,
    String title,
    String description,
    String bannerUrl,
    boolean hasBanner,
    long revision,
    boolean published,
    long contentRevision,
    PathUnlockMode unlockMode,
    List<PathChapterAdminDto> chapters,
    String systemKey
) {}
