package com.hackademy.server.content;

import com.hackademy.server.room.DifficultyLevel;
import com.hackademy.server.room.RoomRepository;
import com.hackademy.server.room.RoomService;
import com.hackademy.server.room.RoomType;
import com.hackademy.server.room.dto.CreateRoomRequest;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class CtfImportService {
    private final RoomRepository rooms;
    private final RoomService roomService;
    private final com.hackademy.server.dashboard.DashboardSummaryCache dashboardSummaryCache;

    public record Result(List<Long> roomIds, int count) {}

    @Transactional(rollbackFor = IOException.class)
    public Result importRooms(MultipartFile file) throws IOException {
        var root = ContentImportReader.read(file);
        var titles = new HashSet<String>();
        if (root.path("rooms").isArray() && root.path("rooms").size() <= 500) {
            root.path("rooms").forEach(item -> {
                if (item.path("title").isTextual()) titles.add(item.path("title").asText().trim());
            });
        }
        Set<String> existing = titles.isEmpty() ? Set.of() : new HashSet<>(rooms.findExistingTitles(RoomType.CTF, titles));
        new ContentImportValidation().validateCtfRooms(root, existing);
        var ids = new ArrayList<Long>();
        for (var item : root.path("rooms")) {
            var hints = new ArrayList<String>();
            item.path("hints").forEach(hint -> hints.add(hint.asText()));
            var room = roomService.createRoom(new CreateRoomRequest(item.path("title").asText().trim(),
                    item.path("description").asText(), item.path("shortDescription").asText(""),
                    DifficultyLevel.valueOf(item.path("difficulty").asText()), item.path("category").asText(),
                    null, item.path("flag").asText(), item.path("requiresVpn").asBoolean(false), RoomType.CTF, hints), null);
            ids.add(room.getId());
        }
        rooms.flush();
        dashboardSummaryCache.invalidateAllAfterCommit();
        return new Result(List.copyOf(ids), ids.size());
    }
}
