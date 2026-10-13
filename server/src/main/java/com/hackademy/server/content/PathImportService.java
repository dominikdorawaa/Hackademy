package com.hackademy.server.content;

import tools.jackson.core.StreamReadFeature;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.hackademy.server.path.*;
import com.hackademy.server.path.dto.PathAdminDetailDto;
import com.hackademy.server.room.*;
import com.hackademy.server.room.dto.*;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class PathImportService {
    public static final int MAX_BYTES = 5 * 1024 * 1024;
    private static final ObjectMapper JSON = tools.jackson.databind.json.JsonMapper.builder()
            .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).build();
    private final PathRepository paths;
    private final PathChapterRepository chapters;
    private final ChapterRoomRepository assignments;
    private final RoomService roomService;
    private final PathService pathService;
    private final com.hackademy.server.dashboard.DashboardSummaryCache dashboardSummaryCache;

    @Transactional(rollbackFor = IOException.class)
    public PathAdminDetailDto importPath(MultipartFile file) throws IOException {
        if (file.isEmpty() || file.getSize() > MAX_BYTES) throw invalid("Wybierz niepusty plik JSON do 5 MB");
        JsonNode root;
        try {
            root = JSON.readTree(file.getBytes());
            if (root == null) throw invalid("Plik nie zawiera dokumentu JSON");
        } catch (tools.jackson.core.JacksonException error) {
            throw invalid("Niepoprawny JSON: sprawdź składnię, powtórzone klucze i dodatkową treść po dokumencie");
        }
        new PathImportValidation().validate(root);
        var path = paths.save(Path.builder().title(root.path("title").asText().trim())
                .description(root.path("description").asText()).published(false)
                .unlockMode(PathUnlockMode.valueOf(root.path("unlockMode").asText("OPEN"))).build());
        int chapterOrder = 0;
        for (var section : root.path("chapters")) {
            var chapter = chapters.save(PathChapter.builder().pathId(path.getId())
                    .title(section.path("title").asText().trim()).sortOrder(chapterOrder++).build());
            int roomOrder = 0;
            for (var item : section.path("rooms")) {
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
                assignments.save(new ChapterRoom(room.getId(), chapter.getId(), roomOrder++));
            }
        }
        assignments.flush();
        dashboardSummaryCache.invalidateAllAfterCommit();
        return pathService.getAdminDetail(path.getId());
    }

    private ContentValidation.InvalidContent invalid(String message) {
        return new ContentValidation.InvalidContent(Map.of("plik", message));
    }
}
