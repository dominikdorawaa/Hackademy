package com.hackademy.server.path;

import com.hackademy.server.room.RoomService;

import com.hackademy.server.path.dto.ChapterRequest;
import com.hackademy.server.path.dto.CreatePathRequest;
import com.hackademy.server.path.dto.PathAdminDetailDto;
import com.hackademy.server.path.dto.PathChapterAdminDto;
import com.hackademy.server.path.dto.PathChapterDto;
import com.hackademy.server.path.dto.PathDetailDto;
import com.hackademy.server.path.dto.PathProgressDto;
import com.hackademy.server.path.dto.PathRoomMiniDto;
import com.hackademy.server.path.dto.PathRoomsMiniResponse;
import com.hackademy.server.path.dto.PathSummaryDto;
import com.hackademy.server.room.dto.RoomSummaryDto;
import com.hackademy.server.path.dto.UpdatePathChaptersRequest;
import com.hackademy.server.path.dto.UpdatePathMetaRequest;
import com.hackademy.server.room.Room;
import com.hackademy.server.room.RoomRepository;
import com.hackademy.server.room.UserSolvedRoomRepository;
import com.hackademy.server.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;
import com.hackademy.server.room.RoomType;

@Service
@RequiredArgsConstructor
public class PathServiceImpl implements PathService {

    private final PathRepository pathRepository;
    private final PathChapterRepository pathChapterRepository;
    private final ChapterRoomRepository chapterRoomRepository;
    private final RoomRepository roomRepository;
    private final RoomService roomService;
    private final PathEnrollmentRepository pathEnrollmentRepository;
    private final UserRepository userRepository;
    private final UserSolvedRoomRepository userSolvedRoomRepository;

    // ── simple in-memory caches (good enough for single instance / dev) ──────

    private static final long CACHE_MS = 30_000; // 30 seconds
    private static final String DEFAULT_CHAPTER_TITLE = "Rozdział 1";

    private volatile long pathsCacheTime = 0;
    private volatile List<PathRepository.PathListView> cachedPathListViews = null;

    private record CacheKey(Long pathId, Long userId, int limit) {}
    private static final class CacheEntry<T> {
        final long timeMs;
        final T value;
        CacheEntry(long timeMs, T value) { this.timeMs = timeMs; this.value = value; }
    }
    private final ConcurrentHashMap<CacheKey, CacheEntry<List<PathRoomMiniDto>>> roomsMiniCache = new ConcurrentHashMap<>();

    // ── helpers ─────────────────────────────────────────────────────────────

    private Long resolveUserId(String username) {
        if (username == null) return null;
        return userRepository.findIdByUsername(username).orElse(null);
    }

    private List<PathRepository.PathListView> getCachedPathListViews() {
        long now = System.currentTimeMillis();
        List<PathRepository.PathListView> local = cachedPathListViews;
        if (local == null || now - pathsCacheTime > CACHE_MS) {
            synchronized (this) {
                local = cachedPathListViews;
                if (local == null || now - pathsCacheTime > CACHE_MS) {
                    cachedPathListViews = pathRepository.findAllListViews();
                    pathsCacheTime = now;
                    local = cachedPathListViews;
                }
            }
        }
        return local;
    }

    private void invalidateCaches() {
        cachedPathListViews = null;
        pathsCacheTime = 0;
        roomsMiniCache.clear();
    }

    // ── list paths ──────────────────────────────────────────────────────────

    public List<PathSummaryDto> listPaths(String username) {
        Long userId = resolveUserId(username);
        Set<Long> enrolledIds = userId != null
                ? pathEnrollmentRepository.findPathIdsByUserId(userId)
                : Set.of();

        return getCachedPathListViews().stream()
                .map(p -> PathSummaryDto.builder()
                        .id(p.getId())
                        .title(p.getTitle())
                        .description(p.getDescription())
                        .bannerUrl(Boolean.TRUE.equals(p.getHasBanner()) ? "/api/paths/" + p.getId() + "/banner" : p.getBannerUrl())
                        .hasBanner(Boolean.TRUE.equals(p.getHasBanner()))
                        .roomsCount(p.getRoomsCount() == null ? 0 : p.getRoomsCount())
                        .enrolled(enrolledIds.contains(p.getId()))
                        .build())
                .toList();
    }

    // ── path detail ─────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<PathProgressDto> getMyPathsProgress(String username) {
        if (username == null || username.isBlank()) return List.of();
        return pathRepository.findProgressForUsername(username).stream()
                .map(v -> {
                    int total = v.getTotalRooms() == null ? 0 : v.getTotalRooms();
                    int solved = v.getSolvedRooms() == null ? 0 : v.getSolvedRooms();
                    boolean completed = total > 0 && solved >= total;
                    return PathProgressDto.builder()
                            .id(v.getId())
                            .title(v.getTitle())
                            .description(v.getDescription())
                            // Use URL banner if provided; DB banner is available via /api/paths/{id}/banner
                            .bannerUrl(v.getBannerUrl())
                            .totalRooms(total)
                            .solvedRooms(solved)
                            .completed(completed)
                            .build();
                })
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public PathDetailDto getPathDetail(Long id, String username) {
        Path path = pathRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Path not found"));
        List<PathChapter> chapters = pathChapterRepository.findByPathIdOrderBySortOrderAscIdAsc(id);
        Map<Long, List<Long>> roomIdsByChapter = roomIdsByChapter(id);

        Long userId = resolveUserId(username);
        boolean enrolled = userId != null && pathEnrollmentRepository.existsByUserIdAndPathId(userId, id);

        Map<Long, RoomSummaryDto> byId = roomService.getAllRoomsByType(username, RoomType.PATH).stream()
                .collect(Collectors.toMap(RoomSummaryDto::getId, Function.identity(), (a, b) -> a));

        List<RoomSummaryDto> rooms = new ArrayList<>();
        List<PathChapterDto> chapterDtos = new ArrayList<>();
        for (PathChapter chapter : chapters) {
            List<RoomSummaryDto> chapterRooms = new ArrayList<>();
            for (Long roomId : roomIdsByChapter.getOrDefault(chapter.getId(), List.of())) {
                RoomSummaryDto dto = byId.get(roomId);
                if (dto == null) continue;
                if (!enrolled) {
                    dto.setSolved(false);
                    dto.setLocked(true);
                }
                chapterRooms.add(dto);
            }
            int solvedRooms = (int) chapterRooms.stream().filter(RoomSummaryDto::isSolved).count();
            chapterDtos.add(new PathChapterDto(chapter.getId(), chapter.getTitle(), chapterRooms.size(), solvedRooms, chapterRooms));
            rooms.addAll(chapterRooms);
        }

        return PathDetailDto.builder()
                .id(path.getId())
                .title(path.getTitle())
                .description(path.getDescription())
                .bannerUrl(path.getBannerData() != null ? "/api/paths/" + path.getId() + "/banner" : path.getBannerUrl())
                .hasBanner(path.getBannerData() != null)
                .enrolled(enrolled)
                .rooms(rooms)
                .chapters(chapterDtos)
                .build();
    }

    // ── enrollment ──────────────────────────────────────────────────────────

    @Override
    @Transactional
    public void enrollUser(Long pathId, String username) {
        if (!pathRepository.existsById(pathId)) {
            throw new IllegalArgumentException("Path not found");
        }
        Long userId = resolveUserId(username);
        if (userId == null) throw new IllegalStateException("User not found: " + username);
        if (!pathEnrollmentRepository.existsByUserIdAndPathId(userId, pathId)) {
            pathEnrollmentRepository.save(PathEnrollment.builder()
                    .userId(userId)
                    .pathId(pathId)
                    .build());
            invalidateCaches();
        }
    }

    @Override
    @Transactional
    public void unenrollUser(Long pathId, String username) {
        Long userId = resolveUserId(username);
        if (userId == null) return;
        pathEnrollmentRepository.deleteByUserIdAndPathId(userId, pathId);
        invalidateCaches();
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isEnrolled(Long pathId, String username) {
        Long userId = resolveUserId(username);
        if (userId == null) return false;
        return pathEnrollmentRepository.existsByUserIdAndPathId(userId, pathId);
    }

    // ── admin / CRUD ─────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public PathRoomsMiniResponse getPathRoomsMini(Long id, String username, int limit) {
        int safeLimit = Math.max(0, Math.min(500, limit));
        if (!pathRepository.existsById(id)) {
            throw new IllegalArgumentException("Path not found");
        }
        Long userId = resolveUserId(username);

        CacheKey key = new CacheKey(id, userId, safeLimit);
        long now = System.currentTimeMillis();
        CacheEntry<List<PathRoomMiniDto>> cached = roomsMiniCache.get(key);
        if (cached != null && now - cached.timeMs <= CACHE_MS) {
            return PathRoomsMiniResponse.builder()
                    .pathId(id)
                    .rooms(cached.value)
                    .build();
        }

        boolean hasTutorialVPN = false;
        boolean hasTutorialVM = false;
        if (userId != null) {
            List<String> solvedTitles = userSolvedRoomRepository.findSolvedRoomTitlesByUserId(
                    userId,
                    List.of("Tutorial VPN", "Tutorial VM")
            );
            hasTutorialVPN = solvedTitles.contains("Tutorial VPN");
            hasTutorialVM = solvedTitles.contains("Tutorial VM");
        }

        List<PathRoomMiniDto> rooms = new ArrayList<>();
        if (safeLimit == 0) {
            // Keep behavior: limit=0 means "return all"
            List<Long> roomIds = chapterRoomRepository.findRoomIdsOrdered(id);
            int effectiveLimit = roomIds.size();
            rooms.addAll(mapMiniRooms(id, userId, effectiveLimit, hasTutorialVPN, hasTutorialVM));
        } else {
            rooms.addAll(mapMiniRooms(id, userId, safeLimit, hasTutorialVPN, hasTutorialVM));
        }

        roomsMiniCache.put(key, new CacheEntry<>(now, rooms));

        return PathRoomsMiniResponse.builder()
                .pathId(id)
                .rooms(rooms)
                .build();
    }

    private List<PathRoomMiniDto> mapMiniRooms(
            Long pathId,
            Long userId,
            int limit,
            boolean hasTutorialVPN,
            boolean hasTutorialVM
    ) {
        Long safeUserId = userId != null ? userId : -1L; // ensures LEFT JOIN condition matches nothing
        List<ChapterRoomRepository.PathRoomMiniRow> rows = chapterRoomRepository.findMiniRoomsForUser(pathId, safeUserId, limit);
        List<PathRoomMiniDto> out = new ArrayList<>(rows.size());
        for (var r : rows) {
            boolean requiresVpn = Boolean.TRUE.equals(r.getRequiresVpn());
            boolean solved = Boolean.TRUE.equals(r.getSolved());
            boolean locked = false;

            // Keep the same gating rules as rooms listing:
            if ("Tutorial VPN".equals(r.getTitle()) && !hasTutorialVM) {
                locked = true;
            }
            if (requiresVpn && !hasTutorialVPN) {
                locked = true;
            }

            out.add(PathRoomMiniDto.builder()
                    .id(r.getId())
                    .title(r.getTitle())
                    .solved(solved)
                    .locked(locked)
                    .requiresVpn(requiresVpn)
                    .build());
        }
        return out;
    }

    @Override
    @Transactional
    public PathSummaryDto createPath(CreatePathRequest request) {
        List<Long> roomIds = request.roomIds() != null ? request.roomIds() : List.of();
        validateRooms(null, roomIds);

        Path saved = pathRepository.save(Path.builder()
                .title(request.title())
                .description(request.description())
                .bannerUrl(request.bannerUrl())
                .build());
        PathChapter chapter = pathChapterRepository.save(PathChapter.builder()
                .pathId(saved.getId())
                .title(DEFAULT_CHAPTER_TITLE)
                .sortOrder(0)
                .build());
        saveChapterRooms(chapter.getId(), roomIds);
        flushAssignments();
        invalidateCaches();

        return PathSummaryDto.builder()
                .id(saved.getId())
                .title(saved.getTitle())
                .description(saved.getDescription())
                .bannerUrl(saved.getBannerUrl())
                .roomsCount(roomIds.size())
                .enrolled(false)
                .build();
    }

    @Override
    @Transactional
    public void deletePath(Long id) {
        if (!pathRepository.existsById(id)) {
            throw new IllegalArgumentException("Path not found");
        }
        pathRepository.deleteById(id);
        invalidateCaches();
    }

    @Override
    @Transactional(readOnly = true)
    public PathAdminDetailDto getAdminDetail(Long id) {
        Path path = pathRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Path not found"));
        Map<Long, List<Long>> roomIdsByChapter = roomIdsByChapter(id);
        List<PathChapterAdminDto> chapters = pathChapterRepository.findByPathIdOrderBySortOrderAscIdAsc(id).stream()
                .map(chapter -> new PathChapterAdminDto(
                        chapter.getId(),
                        chapter.getTitle(),
                        roomIdsByChapter.getOrDefault(chapter.getId(), List.of())))
                .toList();
        return PathAdminDetailDto.builder()
                .id(path.getId())
                .title(path.getTitle())
                .description(path.getDescription())
                .bannerUrl(path.getBannerData() != null ? "/api/paths/" + path.getId() + "/banner" : path.getBannerUrl())
                .hasBanner(path.getBannerData() != null)
                .revision(path.getChaptersRevision())
                .chapters(chapters)
                .build();
    }

    @Override
    @Transactional
    public void updatePathMeta(Long id, UpdatePathMetaRequest request) {
        Path path = pathRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Path not found"));
        path.setTitle(request.title());
        path.setDescription(request.description());
        path.setBannerUrl(request.bannerUrl());
        pathRepository.save(path);
        invalidateCaches();
    }

    @Override
    @Transactional
    public PathAdminDetailDto updatePathChapters(Long id, UpdatePathChaptersRequest request, boolean canDeleteChapters) {
        Path path = pathRepository.findByIdForUpdate(id).orElseThrow(() -> new IllegalArgumentException("Path not found"));
        if (request.revision() == null || request.revision() != path.getChaptersRevision()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Rozdziały zmieniły się w międzyczasie. Odśwież stronę przed ponowną edycją.");
        }
        List<PathChapter> existing = pathChapterRepository.findByPathIdOrderBySortOrderAscIdAsc(id);
        Map<Long, PathChapter> existingById = existing.stream()
                .collect(Collectors.toMap(PathChapter::getId, Function.identity()));

        Set<Long> keptIds = new HashSet<>();
        for (ChapterRequest chapter : request.chapters()) {
            if (chapter.id() == null) continue;
            if (!existingById.containsKey(chapter.id())) {
                throw new IllegalArgumentException("Rozdział " + chapter.id() + " nie należy do tej ścieżki");
            }
            if (!keptIds.add(chapter.id())) {
                throw new IllegalArgumentException("Rozdział " + chapter.id() + " występuje więcej niż raz");
            }
        }
        List<PathChapter> removed = existing.stream()
                .filter(chapter -> !keptIds.contains(chapter.getId()))
                .toList();
        if (!removed.isEmpty() && !canDeleteChapters) {
            throw new AccessDeniedException("Only administrators can delete chapters");
        }

        List<Long> allRoomIds = request.chapters().stream()
                .flatMap(chapter -> chapter.roomIds() == null ? java.util.stream.Stream.<Long>empty() : chapter.roomIds().stream())
                .toList();
        validateRooms(id, allRoomIds);

        chapterRoomRepository.deleteByPathId(id);
        pathChapterRepository.deleteAll(removed);

        int chapterOrder = 0;
        for (ChapterRequest chapterRequest : request.chapters()) {
            PathChapter chapter = chapterRequest.id() == null
                    ? PathChapter.builder().pathId(id).build()
                    : existingById.get(chapterRequest.id());
            chapter.setTitle(chapterRequest.title().trim());
            chapter.setSortOrder(chapterOrder++);
            PathChapter saved = pathChapterRepository.save(chapter);
            saveChapterRooms(saved.getId(), chapterRequest.roomIds() == null ? List.of() : chapterRequest.roomIds());
        }
        path.setChaptersRevision(path.getChaptersRevision() + 1);
        flushAssignments();
        invalidateCaches();
        return getAdminDetail(id);
    }

    private Map<Long, List<Long>> roomIdsByChapter(Long pathId) {
        Map<Long, List<Long>> grouped = new LinkedHashMap<>();
        for (ChapterRoom chapterRoom : chapterRoomRepository.findByPathId(pathId)) {
            grouped.computeIfAbsent(chapterRoom.getChapterId(), key -> new ArrayList<>()).add(chapterRoom.getRoomId());
        }
        return grouped;
    }

    private void validateRooms(Long pathId, List<Long> roomIds) {
        if (roomIds.stream().anyMatch(Objects::isNull)) {
            throw new IllegalArgumentException("Lista pokoi zawiera pusty identyfikator");
        }
        Set<Long> unique = new HashSet<>();
        for (Long roomId : roomIds) {
            if (!unique.add(roomId)) {
                throw new IllegalArgumentException("Pokój " + roomId + " występuje w ścieżce więcej niż raz");
            }
        }
        if (unique.isEmpty()) return;

        // Lock in a stable order before reading types and ownership across paths.
        Map<Long, Room> rooms = new HashMap<>();
        for (Long roomId : unique.stream().sorted().toList()) {
            Room room = roomRepository.findByIdForUpdate(roomId)
                    .orElseThrow(() -> new IllegalArgumentException("Pokój " + roomId + " nie istnieje"));
            rooms.put(roomId, room);
        }
        for (Long roomId : roomIds) {
            Room room = rooms.get(roomId);
            if (room == null) {
                throw new IllegalArgumentException("Pokój " + roomId + " nie istnieje");
            }
            if (room.getRoomType() != RoomType.PATH) {
                throw new IllegalArgumentException("Pokój \u201e" + room.getTitle() + "\u201d nie jest pokojem ścieżki");
            }
        }
        for (ChapterRoomRepository.RoomOwnerView owner : chapterRoomRepository.findOwners(unique)) {
            if (!owner.getPathId().equals(pathId)) {
                throw new IllegalArgumentException("Pokój \u201e" + rooms.get(owner.getRoomId()).getTitle()
                        + "\u201d należy już do ścieżki \u201e" + owner.getPathTitle() + "\u201d");
            }
        }
    }

    private void saveChapterRooms(Long chapterId, List<Long> roomIds) {
        int order = 0;
        for (Long roomId : roomIds) {
            chapterRoomRepository.save(new ChapterRoom(roomId, chapterId, order++));
        }
    }

    private void flushAssignments() {
        try {
            chapterRoomRepository.flush();
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Pokoje ścieżki zmieniły się w międzyczasie. Odśwież stronę i spróbuj ponownie.");
        }
    }

    @Override
    @Transactional
    public void uploadBanner(Long id, MultipartFile file) {
        if (file == null || file.isEmpty()) return;
        Path path = pathRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Path not found"));
        try {
            path.setBannerData(file.getBytes());
            path.setBannerMime(file.getContentType());
            pathRepository.save(path);
            invalidateCaches();
        } catch (Exception e) {
            throw new RuntimeException("Failed to save banner", e);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public byte[] getBannerData(Long id) {
        Path path = pathRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Path not found"));
        return path.getBannerData();
    }

    @Override
    @Transactional(readOnly = true)
    public String getBannerMime(Long id) {
        Path path = pathRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Path not found"));
        return path.getBannerMime();
    }
}
