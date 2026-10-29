package com.hackademy.server.room;

import com.hackademy.server.room.dto.UpdateRoomRequest;

import com.hackademy.server.badge.BadgeDto;
import com.hackademy.server.room.dto.CreateRoomRequest;
import com.hackademy.server.room.dto.HintDto;
import com.hackademy.server.room.dto.RoomAdminSummaryDto;
import com.hackademy.server.room.dto.RoomDetailDto;
import com.hackademy.server.room.dto.RoomSummaryDto;
import com.hackademy.server.room.dto.RoomTasksAdminDto;
import com.hackademy.server.room.dto.UpdateRoomTasksRequest;
import com.hackademy.server.room.dto.SolveRoomResponse;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

public interface RoomService {
    Room createRoom(CreateRoomRequest createRoomRequest, MultipartFile file) throws IOException;
    List<RoomSummaryDto> getAllRooms(String username);
    List<RoomSummaryDto> getAllRoomsByType(String username, RoomType roomType);
    List<RoomAdminSummaryDto> getAllRoomsForAdmin();
    Room updateRoom(Long id, com.hackademy.server.room.dto.UpdateRoomRequest updateRoomRequest, MultipartFile file) throws IOException;
    void deleteRoom(Long id);
    RoomDetailDto getRoomDetail(Long id, String username);
    SolveRoomResponse solveRoom(Long id, String flag, String username);
    HintDto unlockHint(Long roomId, Long hintId, String username);
    Room getRoomById(Long id);
    RoomFile getRoomFile(Long roomId, String username);
    List<RoomSummaryDto> getTop3Rooms();
    SolveRoomResponse solveTask(Long roomId, Long taskId, String answer, String username);
    SolveRoomResponse completeTaskRoom(Long roomId, String username);
    RoomTasksAdminDto getRoomTasksForAdmin(Long roomId);
    RoomTasksAdminDto updateRoomTasks(Long roomId, UpdateRoomTasksRequest request);
}
