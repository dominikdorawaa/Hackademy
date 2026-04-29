package com.hackademy.server.service;

import com.hackademy.server.dto.CreatePathRequest;
import com.hackademy.server.dto.PathAdminDetailDto;
import com.hackademy.server.dto.PathDetailDto;
import com.hackademy.server.dto.PathProgressDto;
import com.hackademy.server.dto.PathRoomMiniDto;
import com.hackademy.server.dto.PathRoomsMiniResponse;
import com.hackademy.server.dto.PathSummaryDto;
import com.hackademy.server.dto.RoomSummaryDto;
import com.hackademy.server.dto.UpdatePathMetaRequest;
import com.hackademy.server.model.Path;
import com.hackademy.server.model.PathEnrollment;
import com.hackademy.server.model.PathRoom;
import com.hackademy.server.model.User;
import com.hackademy.server.repository.PathEnrollmentRepository;
import com.hackademy.server.repository.PathRepository;
import com.hackademy.server.repository.PathRoomRepository;
import com.hackademy.server.repository.RoomRepository;
import com.hackademy.server.repository.UserSolvedRoomRepository;
import com.hackademy.server.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;
import com.hackademy.server.model.RoomType;

@Service
@RequiredArgsConstructor
public class PathServiceImpl implements PathService {

    private final PathRepository pathRepository;
    private final PathRoomRepository pathRoomRepository;
    private final RoomRepository roomRepository;
    private final RoomService roomService;
    private final PathEnrollmentRepository pathEnrollmentRepository;
    private final UserRepository userRepository;
    private final UserSolvedRoomRepository userSolvedRoomRepository;

    // ── simple in-memory caches (good enough for single instance / dev) ──────

    private static final long CACHE_MS = 30_000; // 30 seconds

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
        List<Long> roomIds = pathRoomRepository.findRoomIdsOrdered(id);

        Long userId = resolveUserId(username);
        boolean enrolled = userId != null && pathEnrollmentRepository.existsByUserIdAndPathId(userId, id);

        List<RoomSummaryDto> rooms;
        if (enrolled) {
            // Pobierz pokoje z flagami solved/locked
            List<RoomSummaryDto> allRooms = roomService.getAllRoomsByType(username, RoomType.PATH);
            Map<Long, RoomSummaryDto> byId = allRooms.stream()
                    .collect(Collectors.toMap(RoomSummaryDto::getId, Function.identity(), (a, b) -> a));
            rooms = new ArrayList<>();
            for (Long roomId : roomIds) {
                RoomSummaryDto dto = byId.get(roomId);
                if (dto != null) rooms.add(dto);
            }
        } else {
            // Niezapisany – wszystkie pokoje zablokowane
            List<RoomSummaryDto> allRooms = roomService.getAllRoomsByType(username, RoomType.PATH);
            Map<Long, RoomSummaryDto> byId = allRooms.stream()
                    .collect(Collectors.toMap(RoomSummaryDto::getId, Function.identity(), (a, b) -> a));
            rooms = new ArrayList<>();
            for (Long roomId : roomIds) {
                RoomSummaryDto dto = byId.get(roomId);
                if (dto != null) {
                    dto.setSolved(false);
                    dto.setLocked(true);
                    rooms.add(dto);
                }
            }
        }

        return PathDetailDto.builder()
                .id(path.getId())
                .title(path.getTitle())
                .description(path.getDescription())
                .bannerUrl(path.getBannerData() != null ? "/api/paths/" + path.getId() + "/banner" : path.getBannerUrl())
                .hasBanner(path.getBannerData() != null)
                .enrolled(enrolled)
                .rooms(rooms)
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
            List<Long> roomIds = pathRoomRepository.findRoomIdsOrdered(id);
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
        List<PathRoomRepository.PathRoomMiniRow> rows = pathRoomRepository.findMiniRoomsForUser(pathId, safeUserId, limit);
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
        Path path = Path.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .bannerUrl(request.getBannerUrl())
                .build();

        Path saved = pathRepository.save(path);

        List<Long> roomIds = request.getRoomIds() != null ? request.getRoomIds() : List.of();
        int order = 0;
        for (Long roomId : roomIds) {
            if (roomId == null) continue;
            var room = roomRepository.findById(roomId).orElse(null);
            if (room == null || room.getRoomType() != RoomType.PATH) continue;
            pathRoomRepository.save(new PathRoom(saved.getId(), roomId, order++));
        }
        invalidateCaches();

        return PathSummaryDto.builder()
                .id(saved.getId())
                .title(saved.getTitle())
                .description(saved.getDescription())
                .bannerUrl(saved.getBannerUrl())
                .roomsCount(order)
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
        List<Long> roomIds = pathRoomRepository.findRoomIdsOrdered(id);
        return PathAdminDetailDto.builder()
                .id(path.getId())
                .title(path.getTitle())
                .description(path.getDescription())
                .bannerUrl(path.getBannerData() != null ? "/api/paths/" + path.getId() + "/banner" : path.getBannerUrl())
                .hasBanner(path.getBannerData() != null)
                .roomIds(roomIds)
                .build();
    }

    @Override
    @Transactional
    public void updatePathMeta(Long id, UpdatePathMetaRequest request) {
        Path path = pathRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Path not found"));
        path.setTitle(request.getTitle());
        path.setDescription(request.getDescription());
        path.setBannerUrl(request.getBannerUrl());
        pathRepository.save(path);
        invalidateCaches();
    }

    @Override
    @Transactional
    public void updatePathRooms(Long id, List<Long> roomIds) {
        if (!pathRepository.existsById(id)) {
            throw new IllegalArgumentException("Path not found");
        }

        List<Long> safeIds = roomIds != null ? roomIds : List.of();
        pathRoomRepository.deleteByPathId(id);

        int order = 0;
        for (Long roomId : safeIds) {
            if (roomId == null) continue;
            var room = roomRepository.findById(roomId).orElse(null);
            if (room == null || room.getRoomType() != RoomType.PATH) continue;
            pathRoomRepository.save(new PathRoom(id, roomId, order++));
        }
        invalidateCaches();
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
