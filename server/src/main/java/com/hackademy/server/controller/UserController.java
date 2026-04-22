package com.hackademy.server.controller;

import com.hackademy.server.dto.ActivityDto;
import com.hackademy.server.dto.AuthResponse;
import com.hackademy.server.dto.ChangePasswordRequest;
import com.hackademy.server.dto.RecentSolvedRoomDto;
import com.hackademy.server.dto.RankingEntry;
import com.hackademy.server.dto.UpdateBioRequest;
import com.hackademy.server.dto.UpdateUsernameRequest;
import com.hackademy.server.dto.UserAdminView;
import com.hackademy.server.dto.UserProfileDto;
import com.hackademy.server.dto.UserSearchDto;
import com.hackademy.server.model.User;
import com.hackademy.server.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.PATCH, RequestMethod.DELETE, RequestMethod.OPTIONS})
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getPrincipal())) {
            return ResponseEntity.status(401).body("No authenticated user found");
        }

        User userDetails = (User) authentication.getPrincipal();

        // Calculate effective streak for display
        int effectiveStreak = userDetails.getStreak();
        LocalDate lastSolved = userDetails.getLastSolvedDate();
        LocalDate today = LocalDate.now();
        
        // If last solved was before yesterday, streak is effectively 0 (broken)
        // unless it's 0 already.
        if (lastSolved != null && lastSolved.isBefore(today.minusDays(1))) {
            effectiveStreak = 0;
        }

        // Check if user has solved Tutorial VPN
        boolean hasVpnAccess = userService.hasSolvedTutorialVpn(userDetails.getId());

        // Return a map or a DTO with user details, excluding sensitive info like password
        Map<String, Object> userInfo = Map.of(
                "id", userDetails.getId(),
                "username", userDetails.getUsername(), // Use the actual username
                "email", userDetails.getEmail(),
                "role", userDetails.getRole(),
                "points", userDetails.getPoints(),
                "streak", effectiveStreak,
                "bio", userDetails.getBio() != null ? userDetails.getBio() : "",
                "createdAt", userDetails.getCreatedAt(),
                "hasVpnAccess", hasVpnAccess // New field
        );

        return ResponseEntity.ok(userInfo);
    }

    @PatchMapping("/me/password")
    public ResponseEntity<?> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        userService.changePassword(user.getId(), request);
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/me/username")
    public ResponseEntity<AuthResponse> updateUsername(@Valid @RequestBody UpdateUsernameRequest request) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        AuthResponse response = userService.updateUsername(user.getId(), request);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/me/bio")
    public ResponseEntity<?> updateBio(@Valid @RequestBody UpdateBioRequest request) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        userService.updateBio(user.getId(), request);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/ranking")
    public ResponseEntity<List<RankingEntry>> getRanking() {
        List<RankingEntry> ranking = userService.getTop10Ranking();
        return ResponseEntity.ok(ranking);
    }

    @GetMapping("/me/rank")
    public ResponseEntity<RankingEntry> getMyRank() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        RankingEntry rank = userService.getUserRank(user.getId());
        return ResponseEntity.ok(rank);
    }

    @GetMapping("/{username}")
    public ResponseEntity<UserProfileDto> getPublicProfile(@PathVariable String username) {
        UserProfileDto profile = userService.getPublicProfile(username);
        return ResponseEntity.ok(profile);
    }

    @GetMapping("/search")
    public ResponseEntity<List<UserSearchDto>> searchUsers(@RequestParam String query) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        List<UserSearchDto> results = userService.searchUsers(query, user.getId());
        return ResponseEntity.ok(results);
    }

    @GetMapping("/me/activity")
    public ResponseEntity<List<ActivityDto>> getMyActivity() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        List<ActivityDto> activity = userService.getUserActivity(user.getId());
        return ResponseEntity.ok(activity);
    }

    @GetMapping("/me/recent-solved")
    public ResponseEntity<List<RecentSolvedRoomDto>> getMyRecentSolved(@RequestParam(defaultValue = "3") int limit) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        List<RecentSolvedRoomDto> recent = userService.getRecentSolvedRooms(user.getId(), limit);
        return ResponseEntity.ok(recent);
    }

    @GetMapping("/me/active-time")
    public ResponseEntity<Map<String, Object>> getMyActiveTimeThisWeek() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        try {
            int seconds = userService.getActiveSecondsThisWeek(user.getId());
            return ResponseEntity.ok(Map.of("secondsThisWeek", seconds));
        } catch (RuntimeException e) {
            // If migrations weren't applied yet, don't break the client.
            return ResponseEntity.ok(Map.of("secondsThisWeek", 0));
        }
    }

    @PostMapping("/me/active-time")
    public ResponseEntity<Map<String, Object>> addMyActiveTimeThisWeek(@RequestBody Map<String, Object> payload) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Object deltaObj = payload.get("deltaSeconds");
        int delta = 0;
        if (deltaObj instanceof Number) {
            delta = ((Number) deltaObj).intValue();
        }
        try {
            int seconds = userService.addActiveSecondsThisWeek(user.getId(), delta);
            return ResponseEntity.ok(Map.of("secondsThisWeek", seconds));
        } catch (RuntimeException e) {
            // If migrations weren't applied yet, don't break the client.
            return ResponseEntity.ok(Map.of("secondsThisWeek", 0));
        }
    }

    @GetMapping("/{username}/activity")
    public ResponseEntity<List<ActivityDto>> getUserActivity(@PathVariable String username) {
        Long userId = userService.getUserIdByUsername(username);
        List<ActivityDto> activity = userService.getUserActivity(userId);
        return ResponseEntity.ok(activity);
    }
}
