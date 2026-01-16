package com.hackademy.server.controller;

import com.hackademy.server.dto.RoomDetailDto;
import com.hackademy.server.dto.RoomDto;
import com.hackademy.server.dto.SolveRoomResponse;
import com.hackademy.server.model.RoomFile;
import com.hackademy.server.service.RoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
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
    public ResponseEntity<List<RoomDto>> getAllRooms() {
        return ResponseEntity.ok(roomService.getAllRooms());
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
    public ResponseEntity<SolveRoomResponse> solveRoom(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        String flag = payload.get("flag");
        UserDetails userDetails = (UserDetails) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        
        SolveRoomResponse response = roomService.solveRoom(id, flag, userDetails.getUsername());
        
        // Always return OK if success is true, even if it's training mode (0 points)
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.badRequest().body(response);
        }
    }

    @PostMapping("/{roomId}/hints/{hintId}/unlock")
    public ResponseEntity<?> unlockHint(@PathVariable Long roomId, @PathVariable Long hintId) {
        UserDetails userDetails = (UserDetails) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        try {
            boolean unlocked = roomService.unlockHint(roomId, hintId, userDetails.getUsername());
            // If unlocked is false, it means hint was already unlocked.
            // In training mode, we want to treat this as success or at least not an error that blocks UI.
            if (unlocked) {
                return ResponseEntity.ok(Map.of("message", "Hint unlocked."));
            } else {
                // Return OK even if already unlocked, so frontend doesn't show error
                return ResponseEntity.ok(Map.of("message", "Hint already unlocked."));
            }
        } catch (Exception e) {
             return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/{id}/file")
    public ResponseEntity<Resource> downloadRoomFile(@PathVariable Long id) {
        RoomFile roomFile = roomService.getRoomFile(id);
        
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + roomFile.getFileName() + "\"")
                .contentType(MediaType.parseMediaType(roomFile.getFileType()))
                .contentLength(roomFile.getData().length)
                .body(new ByteArrayResource(roomFile.getData()));
    }
}
