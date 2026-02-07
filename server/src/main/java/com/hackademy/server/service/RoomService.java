package com.hackademy.server.service;

import com.hackademy.server.dto.BadgeDto;
import com.hackademy.server.dto.CreateRoomRequest;
import com.hackademy.server.dto.RoomAdminSummaryDto;
import com.hackademy.server.dto.RoomDetailDto;
import com.hackademy.server.dto.RoomDto;
import com.hackademy.server.dto.RoomSummaryDto;
import com.hackademy.server.dto.SolveRoomResponse;
import com.hackademy.server.model.Room;
import com.hackademy.server.model.RoomFile;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

public interface RoomService {
    Room createRoom(CreateRoomRequest createRoomRequest, MultipartFile file) throws IOException;
    List<RoomSummaryDto> getAllRooms(String username); // Changed return type
    List<RoomAdminSummaryDto> getAllRoomsForAdmin();
    Room updateRoom(Long id, com.hackademy.server.dto.UpdateRoomRequest updateRoomRequest, MultipartFile file) throws IOException;
    void deleteRoom(Long id);
    RoomDetailDto getRoomDetail(Long id, String username);
    SolveRoomResponse solveRoom(Long id, String flag, String username);
    boolean unlockHint(Long roomId, Long hintId, String username);
    // For admin to get the raw entity including flag
    Room getRoomById(Long id);
    RoomFile getRoomFile(Long roomId);
}
