package com.hackademy.server.content;

import com.hackademy.server.path.*;
import com.hackademy.server.path.dto.*;
import com.hackademy.server.room.*;
import com.hackademy.server.room.dto.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.io.IOException;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ContentService {
    private final PathRepository paths;
    private final PathChapterRepository chapters;
    private final ChapterRoomRepository assignments;
    private final RoomRepository rooms;
    private final PathService pathService;
    private final RoomService roomService;
    private final com.hackademy.server.dashboard.DashboardSummaryCache dashboardSummaryCache;

    private void invalidateDashboardAfterCommit() {
        org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                new org.springframework.transaction.support.TransactionSynchronization() {
                    @Override
                    public void afterCommit() { dashboardSummaryCache.invalidateAll(); }
                });
    }

    private static String text(String value) { return value == null ? "" : value; }
    private static void revision(Long supplied, long actual) {
        if (supplied == null || supplied != actual) throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Materiał zmienił się w międzyczasie. Wczytaj aktualną wersję; Twoje zmiany pozostają w edytorze.");
    }

    @Transactional
    public PathAdminDetailDto savePath(Long id, ContentRequests.PathSave request, MultipartFile banner, boolean admin) {
        var validation = new ContentValidation();
        validation.text("title", request.title(), 120, true);
        validation.text("description", request.description(), 20000, request.published());
        validation.url(request.bannerUrl());
        if (request.chapters() == null || request.chapters().size() > 100) validation.problem("chapters", "Podaj maksymalnie 100 rozdziałów");
        if (request.published() && (request.chapters() == null || request.chapters().isEmpty())) validation.problem("chapters", "Dodaj przynajmniej jeden rozdział");
        var list = request.chapters() == null ? List.<ChapterRequest>of() : request.chapters();
        for (int i = 0; i < list.size(); i++) {
            var chapter = list.get(i);
            if (chapter == null) { validation.problem("chapters", "Nieprawidłowy rozdział"); continue; }
            validation.text("chapters." + i + ".title", chapter.title(), 120, true);
            if (chapter.roomIds() == null || chapter.roomIds().size() > 500) validation.problem("chapters." + i + ".rooms", "Podaj maksymalnie 500 pokoi");
            if (request.published() && (chapter.roomIds() == null || chapter.roomIds().isEmpty())) validation.problem("chapters." + i + ".rooms", "Dodaj pokój do rozdziału przed publikacją");
        }
        validation.finish();
        var path = id == null ? paths.save(Path.builder().title(request.title().trim()).published(false).build())
                : paths.findByIdForUpdate(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (id != null) revision(request.revision(), path.getContentRevision());
        long chapterRevision = path.getChaptersRevision();
        if (id != null) revision(request.chaptersRevision(), chapterRevision);
        pathService.updatePathChapters(path.getId(), new UpdatePathChaptersRequest(chapterRevision, list), admin);
        if (request.published()) {
            for (int i = 0; i < list.size(); i++) {
                for (Long roomId : list.get(i).roomIds()) {
                    if (!rooms.findById(roomId).orElseThrow().isPublished()) validation.problem("chapters." + i + ".rooms", "Opublikuj pokoje rozdziału przed publikacją ścieżki");
                }
            }
            validation.finish();
        }
        path.setTitle(request.title().trim());
        path.setDescription(text(request.description()));
        path.setBannerUrl(request.bannerUrl() == null || request.bannerUrl().isBlank() ? null : request.bannerUrl());
        path.setPublished(request.published());
        path.setContentRevision(path.getContentRevision() + 1);
        if (banner != null && !banner.isEmpty()) {
            if (banner.getContentType() == null || !Set.of("image/png", "image/jpeg", "image/webp", "image/gif").contains(banner.getContentType())) validation.problem("bannerFile", "Wybierz obraz PNG, JPEG, WebP lub GIF");
            if (banner.getSize() > 5 * 1024 * 1024) validation.problem("bannerFile", "Banner może mieć maksymalnie 5 MB");
            validation.finish();
            try { path.setBannerData(banner.getBytes()); path.setBannerMime(banner.getContentType()); }
            catch (IOException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nie udało się odczytać bannera"); }
        }
        paths.flush();
        invalidateDashboardAfterCommit();
        return pathService.getAdminDetail(path.getId());
    }

    public record RoomEditor(RoomAdminDto room, RoomTasksAdminDto tasks, Long pathId) {}
    public static RoomAdminDto adminRoom(Room room) {
        return RoomAdminDto.builder().id(room.getId()).title(room.getTitle()).description(room.getDescription())
                .shortDescription(room.getShortDescription()).category(room.getCategory()).difficulty(room.getDifficulty())
                .points(room.getPoints()).flag(room.getFlag()).requiresVpn(room.isRequiresVpn()).roomType(room.getRoomType())
                .published(room.isPublished()).contentRevision(room.getContentRevision()).solutionsCount(room.getSolutionsCount())
                .hints(room.getHints().stream().map(Hint::getDescription).toList()).createdAt(room.getCreatedAt()).updatedAt(room.getUpdatedAt()).build();
    }
    @Transactional
    public RoomEditor roomEditor(Long id) {
        var room = roomService.getRoomById(id);
        return new RoomEditor(adminRoom(room), roomService.getRoomTasksForAdmin(id), assignments.findOwners(List.of(id)).stream().map(ChapterRoomRepository.RoomOwnerView::getPathId).findFirst().orElse(null));
    }

    @Transactional(rollbackFor = IOException.class)
    public RoomEditor saveRoom(Long id, ContentRequests.RoomSave r, MultipartFile file) throws IOException {
        var v = new ContentValidation();
        v.text("title", r.title(), 255, true);
        v.text("description", r.description(), 20000, r.published());
        v.text("shortDescription", r.shortDescription(), 100, false);
        v.text("category", r.category(), 255, true);
        v.text("flag", r.flag(), 255, r.published() && (r.tasks() == null || r.tasks().isEmpty()));
        if (r.difficulty() == null) v.problem("difficulty", "Wybierz trudność");
        if (r.roomType() == null) v.problem("roomType", "Wybierz typ pokoju");
        if (r.roomType() == RoomType.PATH && (r.points() == null || r.points() < 0)) v.problem("points", "Podaj nieujemną liczbę punktów");
        var hints = r.hints() == null ? List.<String>of() : r.hints();
        if (hints.size() > 100) v.problem("hints", "Maksymalnie 100 podpowiedzi");
        for (int i = 0; i < hints.size(); i++) v.text("hints." + i, hints.get(i), 2000, true);
        var tasks = r.tasks() == null ? List.<RoomTaskRequest>of() : r.tasks();
        if (tasks.size() > 100) v.problem("tasks", "Maksymalnie 100 zadań");
        if (r.roomType() != RoomType.PATH && !tasks.isEmpty()) v.problem("tasks", "Zadania są dostępne w pokojach PATH");
        for (int i = 0; i < tasks.size(); i++) {
            var t = tasks.get(i); String key = "tasks." + i + ".";
            if (t == null) { v.problem("tasks", "Nieprawidłowe zadanie"); continue; }
            v.text(key + "title", t.title(), 255, true);
            v.text(key + "content", t.content(), 20000, r.published());
            if (r.published() && TaskContentSanitizer.clean(text(t.content())).isBlank()) v.problem(key + "content", "Podaj treść po usunięciu niedozwolonego HTML");
            v.text(key + "question", t.question(), 2000, false);
            v.text(key + "answer", t.answer(), 255, r.published() && t.question() != null && !t.question().isBlank());
            if (r.published() && (t.question() == null || t.question().isBlank()) && t.answer() != null && !t.answer().isBlank()) v.problem(key + "question", "Odpowiedź wymaga pytania");
        }
        v.finish();
        Path parent = null; PathChapter chapter = null; boolean publishParent = false;
        if (r.parentDraft() != null) {
            if (id != null || r.roomType() != RoomType.PATH || r.chapterIndex() == null || r.chapterIndex() < 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nieprawidłowy szkic kontekstu");
            var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            boolean admin = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
            var draft = r.parentDraft();
            publishParent = draft.published();
            var savedPath = savePath(r.pathId(), new ContentRequests.PathSave(draft.revision(), draft.chaptersRevision(), draft.title(), draft.description(), draft.bannerUrl(), false, draft.chapters()), null, admin);
            if (r.chapterIndex() >= savedPath.chapters().size()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nieprawidłowy rozdział");
            parent = paths.findByIdForUpdate(savedPath.id()).orElseThrow();
            chapter = chapters.findById(savedPath.chapters().get(r.chapterIndex()).id()).orElseThrow();
        } else if (r.pathId() != null || r.chapterId() != null) {
            if (id != null || r.roomType() != RoomType.PATH || r.pathId() == null || r.chapterId() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nieprawidłowy kontekst rozdziału");
            parent = paths.findByIdForUpdate(r.pathId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            revision(r.pathRevision(), parent.getContentRevision());
            chapter = chapters.findById(r.chapterId()).filter(c -> c.getPathId().equals(r.pathId())).orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Rozdział nie należy do tej ścieżki"));
        }
        if (chapter != null && assignments.existsRoomWithTitleInChapter(chapter.getId(), r.title().trim())) {
            throw new RoomRuleException(HttpStatus.CONFLICT, "title", "Ten rozdział ma już pokój o tym tytule");
        }
        Room saved;
        if (id == null) {
            saved = roomService.createRoom(new CreateRoomRequest(r.title().trim(), text(r.description()), text(r.shortDescription()), r.difficulty(), r.category(), r.points(), text(r.flag()), r.requiresVpn(), r.roomType(), hints), file);
        } else {
            var current = rooms.findByIdForUpdate(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            revision(r.revision(), current.getContentRevision());
            revision(r.tasksRevision(), current.getTasksRevision());
            saved = roomService.updateRoom(id, new UpdateRoomRequest(r.title().trim(), text(r.description()), text(r.shortDescription()), r.difficulty(), r.category(), r.points(), text(r.flag()), r.requiresVpn(), r.roomType(), hints), file);
        }
        saved.setPublished(r.published());
        if (r.roomType() == RoomType.PATH) roomService.updateRoomTasks(saved.getId(), new UpdateRoomTasksRequest(saved.getTasksRevision(), tasks));
        saved.setContentRevision(saved.getContentRevision() + 1);
        if (chapter != null) {
            Long targetChapterId = chapter.getId();
            long count = assignments.findByPathId(parent.getId()).stream().filter(a -> a.getChapterId().equals(targetChapterId)).count();
            assignments.save(new ChapterRoom(saved.getId(), chapter.getId(), (int) count));
            parent.setChaptersRevision(parent.getChaptersRevision() + 1);
            parent.setContentRevision(parent.getContentRevision() + 1);
            if (publishParent) {
                if (!saved.isPublished()) v.problem("published", "Opublikuj pokój, aby dodać nowy rozdział do opublikowanej ścieżki, albo przenieś ścieżkę do szkiców.");
                v.finish();
                var updated = pathService.getAdminDetail(parent.getId());
                v.text("parentDescription", parent.getDescription(), 20000, true);
                for (var section : updated.chapters()) {
                    if (section.roomIds().isEmpty()) v.problem("published", "Dodaj opublikowany pokój do każdego rozdziału ścieżki.");
                    for (Long roomId : section.roomIds()) if (!rooms.findById(roomId).orElseThrow().isPublished()) v.problem("published", "Opublikuj wszystkie pokoje ścieżki.");
                }
                v.finish();
                parent.setPublished(true);
            }
        }
        rooms.flush();
        invalidateDashboardAfterCommit();
        return roomEditor(saved.getId());
    }

    @Transactional(readOnly = true)
    public RoomDetailDto previewRoom(Long id) {
        var r = roomService.getRoomById(id);
        var hints = r.getHints().stream().sorted(Comparator.comparing(Hint::getId)).map(h -> new HintDto(h.getId(), h.getDescription())).toList();
        var tasks = r.getTasks().stream().sorted(Comparator.comparingInt(RoomTask::getSortOrder).thenComparing(RoomTask::getId)).map(t -> RoomTaskDto.builder().id(t.getId()).title(t.getTitle()).content(t.getContent()).question(t.getQuestion()).completed(false).build()).toList();
        return RoomDetailDto.builder().id(r.getId()).title(r.getTitle()).description(r.getDescription()).shortDescription(r.getShortDescription()).difficulty(r.getDifficulty()).points(r.getPoints()).solutionsCount(r.getSolutionsCount()).createdAt(r.getCreatedAt()).solved(false).requiresVpn(r.isRequiresVpn()).hints(hints).unlockedHintIds(List.of()).fileName(r.getRoomFile() == null ? null : r.getRoomFile().getFileName()).tasks(tasks).build();
    }

    @Transactional(readOnly = true)
    public PathDetailDto previewPath(Long id) {
        var p = paths.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        var links = assignments.findByPathId(id);
        var all = new ArrayList<RoomSummaryDto>();
        var sections = new ArrayList<PathChapterDto>();
        for (var c : chapters.findByPathIdOrderBySortOrderAscIdAsc(id)) {
            var chapterRooms = links.stream().filter(a -> a.getChapterId().equals(c.getId())).map(a -> roomService.getRoomById(a.getRoomId())).map(r -> new RoomSummaryDto(r.getId(), r.getTitle(), r.getShortDescription(), r.getDifficulty(), r.getCategory(), r.getPoints(), r.getSolutionsCount(), r.isRequiresVpn(), r.getRoomType(), r.getCreatedAt())).toList();
            all.addAll(chapterRooms);
            sections.add(new PathChapterDto(c.getId(), c.getTitle(), chapterRooms.size(), 0, chapterRooms));
        }
        return PathDetailDto.builder().id(p.getId()).title(p.getTitle()).description(p.getDescription()).bannerUrl(p.getBannerData() == null ? p.getBannerUrl() : "/api/admin/content/paths/" + id + "/banner").hasBanner(p.getBannerData() != null).enrolled(true).chapters(sections).rooms(all).build();
    }

    @Transactional(readOnly = true)
    public List<PathSummaryDto> adminPaths() {
        return paths.findAdminListViews().stream().map(p -> PathSummaryDto.builder().id(p.getId()).title(p.getTitle()).description(p.getDescription()).bannerUrl(p.getBannerUrl()).hasBanner(Boolean.TRUE.equals(p.getHasBanner())).published(Boolean.TRUE.equals(p.getPublished())).roomsCount(p.getRoomsCount()).enrolled(false).build()).toList();
    }
}
