package com.hackademy.server.content;

import tools.jackson.databind.JsonNode;
import com.hackademy.server.path.*;
import com.hackademy.server.path.dto.PathAdminDetailDto;
import com.hackademy.server.room.*;
import com.hackademy.server.room.dto.*;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class PathImportService {
    public static final int MAX_BYTES = ContentImportReader.MAX_BYTES;
    private final PathRepository paths;
    private final PathChapterRepository chapters;
    private final ChapterRoomRepository assignments;
    private final RoomService roomService;
    private final RoomRepository rooms;
    private final PathService pathService;
    private final com.hackademy.server.dashboard.DashboardSummaryCache dashboardSummaryCache;

    @Transactional(rollbackFor = IOException.class)
    public PathAdminDetailDto importPath(MultipartFile file) throws IOException {
        JsonNode root = ContentImportReader.read(file);
        new ContentImportValidation().validate(root);
        var path = paths.save(Path.builder().title(root.path("title").asText().trim())
                .description(root.path("description").asText()).published(false)
                .unlockMode(PathUnlockMode.valueOf(root.path("unlockMode").asText("OPEN"))).build());
        int chapterOrder = 0;
        for (var section : root.path("chapters")) {
            var chapter = chapters.save(PathChapter.builder().pathId(path.getId())
                    .title(section.path("title").asText().trim()).sortOrder(chapterOrder++).build());
            saveRooms(section.path("rooms"), chapter.getId(), 0);
        }
        return finish(path.getId());
    }

    @Transactional(rollbackFor = IOException.class)
    public PathAdminDetailDto importRooms(Long pathId, ContentRequests.RoomImport target, MultipartFile file) throws IOException {
        JsonNode root = ContentImportReader.read(file);
        if (target == null || target.chapterId() == null || target.contentRevision() == null || target.chaptersRevision() == null) {
            throw new ContentValidation.InvalidContent(Map.of("cel", "Wybierz rozdział i wczytaj aktualną wersję ścieżki"));
        }
        var path = paths.findByIdForUpdate(pathId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (target.contentRevision() != path.getContentRevision() || target.chaptersRevision() != path.getChaptersRevision()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ścieżka zmieniła się w międzyczasie. Wczytaj aktualną wersję przed importem.");
        }
        var chapter = chapters.findById(target.chapterId()).filter(c -> c.getPathId().equals(pathId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Wybrany rozdział nie należy do tej ścieżki"));
        var links = assignments.findByPathId(pathId).stream().filter(link -> link.getChapterId().equals(chapter.getId())).toList();
        var titles = rooms.findAllById(links.stream().map(ChapterRoom::getRoomId).toList()).stream()
                .map(Room::getTitle).collect(Collectors.toSet());
        new ContentImportValidation().validateRooms(root, titles, links.size());
        int nextOrder = links.stream().mapToInt(ChapterRoom::getSortOrder).max().orElse(-1) + 1;
        saveRooms(root.path("rooms"), chapter.getId(), nextOrder);
        path.setChaptersRevision(path.getChaptersRevision() + 1);
        path.setContentRevision(path.getContentRevision() + 1);
        return finish(pathId);
    }

    private void saveRooms(JsonNode items, Long chapterId, int roomOrder) throws IOException {
        for (var item : items) {
            var hints = new ArrayList<String>();
            item.path("hints").forEach(hint -> hints.add(hint.asText()));
            var room = roomService.createRoom(new CreateRoomRequest(item.path("title").asText().trim(),
                    item.path("description").asText(), item.path("shortDescription").asText(""),
                    DifficultyLevel.valueOf(item.path("difficulty").asText()), item.path("category").asText(),
                    item.path("points").intValue(), item.path("flag").asText(""),
                    item.path("requiresVpn").asBoolean(false), RoomType.PATH, hints), null);
            var tasks = new ArrayList<RoomTaskRequest>();
            item.path("tasks").forEach(task -> tasks.add(new RoomTaskRequest(null, task.path("title").asText(),
                    task.path("content").asText(), task.path("question").asText(null), task.path("answer").asText(null))));
            roomService.updateRoomTasks(room.getId(), new UpdateRoomTasksRequest(room.getTasksRevision(), tasks));
            assignments.save(new ChapterRoom(room.getId(), chapterId, roomOrder++));
        }
    }

    private PathAdminDetailDto finish(Long pathId) {
        assignments.flush();
        dashboardSummaryCache.invalidateAllAfterCommit();
        return pathService.getAdminDetail(pathId);
    }

}
