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
import com.hackademy.server.model.PathRoom;
import com.hackademy.server.repository.PathRepository;
import com.hackademy.server.repository.PathRoomRepository;
import com.hackademy.server.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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

    @Override
    @Transactional(readOnly = true)
    public List<PathSummaryDto> listPaths() {
        return pathRepository.findAllListViews().stream()
                .map(v -> PathSummaryDto.builder()
                        .id(v.getId())
                        .title(v.getTitle())
                        .description(v.getDescription())
                        // If banner is stored in DB, frontend can request it lazily via /api/paths/{id}/banner
                        .bannerUrl(v.getBannerUrl())
                        .hasBanner(Boolean.TRUE.equals(v.getHasBanner()))
                        .roomsCount(v.getRoomsCount() == null ? 0 : v.getRoomsCount())
                        .build())
                .toList();
    }

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

        // Build room summaries (with solved/locked flags) and filter to PATH rooms only.
        List<RoomSummaryDto> allRooms = roomService.getAllRoomsByType(username, RoomType.PATH);
        Map<Long, RoomSummaryDto> byId = allRooms.stream().collect(Collectors.toMap(RoomSummaryDto::getId, Function.identity(), (a, b) -> a));

        List<RoomSummaryDto> rooms = new ArrayList<>();
        for (Long roomId : roomIds) {
            RoomSummaryDto dto = byId.get(roomId);
            if (dto != null) rooms.add(dto);
        }

        return PathDetailDto.builder()
                .id(path.getId())
                .title(path.getTitle())
                .description(path.getDescription())
                .bannerUrl(path.getBannerData() != null ? "/api/paths/" + path.getId() + "/banner" : path.getBannerUrl())
                .hasBanner(path.getBannerData() != null)
                .rooms(rooms)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public PathRoomsMiniResponse getPathRoomsMini(Long id, String username, int limit) {
        int safeLimit = Math.max(0, Math.min(500, limit));
        Path path = pathRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Path not found"));
        List<Long> roomIds = pathRoomRepository.findRoomIdsOrdered(id);

        // Reuse existing solved/locked logic, but return a minimal payload for dashboards.
        List<RoomSummaryDto> allRooms = roomService.getAllRoomsByType(username, RoomType.PATH);
        Map<Long, RoomSummaryDto> byId = allRooms.stream()
                .collect(Collectors.toMap(RoomSummaryDto::getId, Function.identity(), (a, b) -> a));

        List<PathRoomMiniDto> rooms = new ArrayList<>();
        for (Long roomId : roomIds) {
            RoomSummaryDto dto = byId.get(roomId);
            if (dto == null) continue;
            rooms.add(PathRoomMiniDto.builder()
                    .id(dto.getId())
                    .title(dto.getTitle())
                    .solved(dto.isSolved())
                    .locked(dto.isLocked())
                    .requiresVpn(dto.isRequiresVpn())
                    .build());
            if (safeLimit > 0 && rooms.size() >= safeLimit) break;
        }

        return PathRoomsMiniResponse.builder()
                .pathId(path.getId())
                .rooms(rooms)
                .build();
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
            // Validate room exists (fast exists check)
            if (roomId == null) continue;
            var room = roomRepository.findById(roomId).orElse(null);
            if (room == null || room.getRoomType() != RoomType.PATH) continue;
            pathRoomRepository.save(new PathRoom(saved.getId(), roomId, order++));
        }

        return PathSummaryDto.builder()
                .id(saved.getId())
                .title(saved.getTitle())
                .description(saved.getDescription())
                .bannerUrl(saved.getBannerUrl())
                .roomsCount(order)
                .build();
    }

    @Override
    @Transactional
    public void deletePath(Long id) {
        if (!pathRepository.existsById(id)) {
            throw new IllegalArgumentException("Path not found");
        }
        pathRepository.deleteById(id);
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

