package com.hackademy.server.controller;

import com.hackademy.server.dto.CreateRoomRequest;
import com.hackademy.server.dto.RoomAdminDto;
import com.hackademy.server.dto.UpdateUserRoleRequest;
import com.hackademy.server.dto.UserAdminView;
import com.hackademy.server.model.Room;
import com.hackademy.server.service.RoomService;
import com.hackademy.server.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'EXPERT')")
public class AdminController {

    private final RoomService roomService;
    private final UserService userService;

    @PostMapping(value = "/rooms", consumes = { MediaType.MULTIPART_FORM_DATA_VALUE })
    @ResponseStatus(HttpStatus.CREATED)
    public RoomAdminDto createRoom(
            @RequestPart("room") @Valid CreateRoomRequest createRoomRequest,
            @RequestPart(value = "file", required = false) MultipartFile file
    ) throws IOException {
        Room room = roomService.createRoom(createRoomRequest, file);
        return mapToAdminDto(room);
    }

    @PutMapping(value = "/rooms/{id}", consumes = { MediaType.MULTIPART_FORM_DATA_VALUE })
    public RoomAdminDto updateRoom(
            @PathVariable Long id,
            @RequestPart("room") @Valid com.hackademy.server.dto.UpdateRoomRequest updateRoomRequest,
            @RequestPart(value = "file", required = false) MultipartFile file
    ) throws IOException {
        Room room = roomService.updateRoom(id, updateRoomRequest, file);
        return mapToAdminDto(room);
    }

    @GetMapping("/rooms/{id}")
    public RoomAdminDto getRoom(@PathVariable Long id) {
        Room room = roomService.getRoomById(id);
        return mapToAdminDto(room);
    }

    @DeleteMapping("/rooms/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteRoom(@PathVariable Long id) {
        roomService.deleteRoom(id);
    }

    @GetMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    public List<UserAdminView> getAllUsers() {
        return userService.findAllUsers();
    }

    @DeleteMapping("/users/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteUser(@PathVariable Long id) {
        userService.deleteUser(id);
    }

    @PutMapping("/users/{id}/role")
    @PreAuthorize("hasRole('ADMIN')")
    public UserAdminView updateUserRole(@PathVariable Long id, @Valid @RequestBody UpdateUserRoleRequest request) {
        return userService.updateUserRole(id, request.getRole());
    }

    private RoomAdminDto mapToAdminDto(Room room) {
        List<String> hintDescriptions = room.getHints().stream()
                .map(com.hackademy.server.model.Hint::getDescription)
                .collect(Collectors.toList());

        return RoomAdminDto.builder()
                .id(room.getId())
                .title(room.getTitle())
                .description(room.getDescription())
                .shortDescription(room.getShortDescription())
                .difficulty(room.getDifficulty())
                .points(room.getPoints())
                .flag(room.getFlag())
                .solutionsCount(room.getSolutionsCount())
                .hints(hintDescriptions)
                .createdAt(room.getCreatedAt())
                .updatedAt(room.getUpdatedAt())
                .build();
    }
}
