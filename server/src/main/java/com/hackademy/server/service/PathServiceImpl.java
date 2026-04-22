package com.hackademy.server.service;

import com.hackademy.server.dto.CreatePathRequest;
import com.hackademy.server.dto.PathAdminDetailDto;
import com.hackademy.server.dto.PathDetailDto;
import com.hackademy.server.dto.PathSummaryDto;
import com.hackademy.server.dto.RoomSummaryDto;
import com.hackademy.server.model.Path;
import com.hackademy.server.model.PathRoom;
import com.hackademy.server.repository.PathRepository;
import com.hackademy.server.repository.PathRoomRepository;
import com.hackademy.server.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
        List<Path> paths = pathRepository.findAll();
        Map<Long, Long> counts = paths.stream()
                .collect(Collectors.toMap(Path::getId, p -> pathRoomRepository.countByPathId(p.getId())));

        return paths.stream()
                .map(p -> PathSummaryDto.builder()
                        .id(p.getId())
                        .title(p.getTitle())
                        .description(p.getDescription())
                        .roomsCount(counts.getOrDefault(p.getId(), 0L).intValue())
                        .build())
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
                .rooms(rooms)
                .build();
    }

    @Override
    @Transactional
    public PathSummaryDto createPath(CreatePathRequest request) {
        Path path = Path.builder()
                .title(request.getTitle())
                .description(request.getDescription())
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
                .roomIds(roomIds)
                .build();
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
}

