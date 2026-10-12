package com.hackademy.server.content;

import com.hackademy.server.path.dto.ChapterRequest;
import com.hackademy.server.room.DifficultyLevel;
import com.hackademy.server.room.RoomType;
import com.hackademy.server.room.dto.RoomTaskRequest;
import java.util.List;

public final class ContentRequests {
    private ContentRequests() {}
    public record PathSave(Long revision, Long chaptersRevision, String title, String description,
                           String bannerUrl, boolean published, List<ChapterRequest> chapters) {}
    public record RoomSave(Long revision, Long tasksRevision, String title, String description,
                           String shortDescription, DifficultyLevel difficulty, String category, Integer points,
                           String flag, boolean requiresVpn, RoomType roomType, List<String> hints,
                           boolean published, List<RoomTaskRequest> tasks, Long pathId, Long chapterId, Long pathRevision, PathSave parentDraft, Integer chapterIndex) {}
}
