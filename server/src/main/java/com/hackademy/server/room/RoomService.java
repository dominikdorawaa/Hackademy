package com.hackademy.server.room;

import com.hackademy.server.room.dto.UpdateRoomRequest;

import com.hackademy.server.badge.BadgeDto;
import com.hackademy.server.room.dto.CreateRoomRequest;
import com.hackademy.server.room.dto.RoomAdminSummaryDto;
import com.hackademy.server.room.dto.RoomDetailDto;
import com.hackademy.server.room.dto.RoomDto;
import com.hackademy.server.room.dto.RoomSummaryDto;
import com.hackademy.server.room.dto.SolveRoomResponse;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

public interface RoomService {
    Room createRoom(CreateRoomRequest createRoomRequest, MultipartFile file) throws IOException;
    List<RoomSummaryDto> getAllRooms(String username); // Changed return type
    List<RoomSummaryDto> getAllRoomsByType(String username, RoomType roomType);
    List<RoomAdminSummaryDto> getAllRoomsForAdmin();
    Room updateRoom(Long id, com.hackademy.server.room.dto.UpdateRoomRequest updateRoomRequest, MultipartFile file) throws IOException;
    void deleteRoom(Long id);
    RoomDetailDto getRoomDetail(Long id, String username);
    SolveRoomResponse solveRoom(Long id, String flag, String username);
    boolean unlockHint(Long roomId, Long hintId, String username);
    // For admin to get the raw entity including flag
    Room getRoomById(Long id);
    RoomFile getRoomFile(Long roomId);
    List<RoomSummaryDto> getTop3Rooms(); // New method for landing page
    SolveRoomResponse solveTask(Long roomId, Long taskId, String answer, String username);
}
