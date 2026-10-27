package com.hackademy.server.room;


import com.hackademy.server.user.User;

import com.hackademy.server.room.dto.HintDto;
import com.hackademy.server.room.dto.RoomSummaryDto;
import com.hackademy.server.room.dto.SolveRoomResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;

    @GetMapping
    public ResponseEntity<List<RoomSummaryDto>> getAllRooms() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        String username = null;
        if (principal instanceof UserDetails) {
            username = ((UserDetails) principal).getUsername();
        }
        return ResponseEntity.ok(roomService.getAllRooms(username));
    }

    @GetMapping("/top3")
    public ResponseEntity<List<RoomSummaryDto>> getTop3Rooms() {
        return ResponseEntity.ok(roomService.getTop3Rooms());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getRoomDetail(@PathVariable Long id) {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();

        if (principal instanceof UserDetails) {
            UserDetails userDetails = (UserDetails) principal;
            return ResponseEntity.ok(roomService.getRoomDetail(id, userDetails.getUsername()));
        } else {
            // Should be handled by Security filter, but just in case
            return ResponseEntity.status(401).body(Map.of("message", "User not authenticated"));
        }
    }

    @PostMapping("/{id}/solve")
    public ResponseEntity<SolveRoomResponse> solveRoom(@PathVariable Long id,
            @RequestBody Map<String, String> payload) {
        String flag = payload.get("flag");
        UserDetails userDetails = (UserDetails) SecurityContextHolder.getContext().getAuthentication().getPrincipal();

        SolveRoomResponse response = roomService.solveRoom(id, flag, userDetails.getUsername());

        if (response.success()) {
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.badRequest().body(response);
        }
    }

    @PostMapping("/{roomId}/tasks/{taskId}/solve")
    public ResponseEntity<SolveRoomResponse> solveTask(
            @PathVariable Long roomId,
            @PathVariable Long taskId,
            @RequestBody Map<String, String> payload) {
        String answer = payload.get("answer");
        UserDetails userDetails = (UserDetails) SecurityContextHolder.getContext().getAuthentication().getPrincipal();

        SolveRoomResponse response = roomService.solveTask(roomId, taskId, answer, userDetails.getUsername());

        if (response.success()) {
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.badRequest().body(response);
        }
    }

    @PostMapping("/{roomId}/tasks/complete")
    public ResponseEntity<SolveRoomResponse> completeTaskRoom(@PathVariable Long roomId) {
        UserDetails userDetails = (UserDetails) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        SolveRoomResponse response = roomService.completeTaskRoom(roomId, userDetails.getUsername());
        return response.success() ? ResponseEntity.ok(response) : ResponseEntity.badRequest().body(response);
    }

    @PostMapping("/{roomId}/hints/{hintId}/unlock")
    public ResponseEntity<HintDto> unlockHint(@PathVariable Long roomId, @PathVariable Long hintId) {
        UserDetails userDetails = (UserDetails) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        try {
            return ResponseEntity.ok(roomService.unlockHint(roomId, hintId, userDetails.getUsername()));
        } catch (DataIntegrityViolationException e) {
            // A concurrent request unlocked the same hint first; the retry sees it as already unlocked
            return ResponseEntity.ok(roomService.unlockHint(roomId, hintId, userDetails.getUsername()));
        }
    }

    @GetMapping("/{id}/file")
    public ResponseEntity<Resource> downloadRoomFile(@PathVariable Long id) {
        UserDetails userDetails = (UserDetails) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        RoomFile roomFile = roomService.getRoomFile(id, userDetails.getUsername());

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + roomFile.getFileName() + "\"")
                .contentType(MediaType.parseMediaType(roomFile.getFileType()))
                .contentLength(roomFile.getData().length)
                .body(new ByteArrayResource(roomFile.getData()));
    }
}
