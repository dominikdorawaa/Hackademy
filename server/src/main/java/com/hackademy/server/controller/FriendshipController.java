package com.hackademy.server.controller;

import com.hackademy.server.dto.FriendDto;
import com.hackademy.server.dto.FriendRequestDto;
import com.hackademy.server.dto.UserSearchDto;
import com.hackademy.server.model.User;
import com.hackademy.server.service.FriendshipService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/friends")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.PATCH, RequestMethod.DELETE, RequestMethod.OPTIONS})
public class FriendshipController {

    private final FriendshipService friendshipService;

    @PostMapping("/request/{username}")
    public ResponseEntity<?> sendFriendRequest(@PathVariable String username) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        friendshipService.sendFriendRequest(user.getId(), username);
        return ResponseEntity.ok().body(Map.of("message", "Friend request sent"));
    }

    @PostMapping("/accept/{requestId}")
    public ResponseEntity<?> acceptFriendRequest(@PathVariable Long requestId) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        friendshipService.acceptFriendRequest(user.getId(), requestId);
        return ResponseEntity.ok().body(Map.of("message", "Friend request accepted"));
    }

    @PostMapping("/reject/{requestId}")
    public ResponseEntity<?> rejectFriendRequest(@PathVariable Long requestId) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        friendshipService.rejectFriendRequest(user.getId(), requestId);
        return ResponseEntity.ok().body(Map.of("message", "Friend request rejected"));
    }

    @DeleteMapping("/{friendId}")
    public ResponseEntity<?> removeFriend(@PathVariable Long friendId) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        friendshipService.removeFriend(user.getId(), friendId);
        return ResponseEntity.ok().body(Map.of("message", "Friend removed"));
    }

    @GetMapping
    public ResponseEntity<List<FriendDto>> getFriends() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(friendshipService.getFriends(user.getId()));
    }

    @GetMapping("/requests")
    public ResponseEntity<List<FriendRequestDto>> getPendingRequests() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(friendshipService.getPendingRequests(user.getId()));
    }

    @GetMapping("/status/{username}")
    public ResponseEntity<?> getFriendshipStatus(@PathVariable String username) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        String status = friendshipService.getFriendshipStatus(user.getId(), username);
        return ResponseEntity.ok(Map.of("status", status));
    }

    @GetMapping("/stats/{username}")
    public ResponseEntity<UserSearchDto> getFriendshipStats(@PathVariable String username) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(friendshipService.getFriendshipStats(user.getId(), username));
    }
}
