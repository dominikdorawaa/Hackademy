package com.hackademy.server.user;

import com.hackademy.server.dashboard.ActivityDto;
import com.hackademy.server.auth.AuthResponse;
import com.hackademy.server.user.dto.ChangePasswordRequest;
import com.hackademy.server.room.dto.RecentSolvedRoomDto;
import com.hackademy.server.ranking.RankingEntry;
import com.hackademy.server.user.dto.UpdateBioRequest;
import com.hackademy.server.user.dto.UpdateUsernameRequest;
import com.hackademy.server.user.dto.UserProfileDto;
import com.hackademy.server.user.dto.ProfilePortfolioDto;
import com.hackademy.server.user.dto.ProfileStatsDto;
import com.hackademy.server.user.dto.UserSearchDto;
import com.hackademy.server.user.dto.UpdateProfileRequest;
import com.hackademy.server.user.dto.ProfilePersonalizationDto;
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
@CrossOrigin(origins = "http://localhost:5173", allowedHeaders = "*", methods = { RequestMethod.GET, RequestMethod.POST,
        RequestMethod.PUT, RequestMethod.PATCH, RequestMethod.DELETE, RequestMethod.OPTIONS })
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return ResponseEntity.status(401).body("No authenticated user found");
        }

        User userDetails = (User) authentication.getPrincipal();

        int effectiveStreak = userDetails.getStreak();
        LocalDate lastSolved = userDetails.getLastSolvedDate();
        LocalDate today = LocalDate.now();

        if (lastSolved != null && lastSolved.isBefore(today.minusDays(1))) {
            effectiveStreak = 0;
        }

        boolean hasVpnAccess = userService.hasSolvedTutorialVpn(userDetails.getId());

        Map<String, Object> userInfo = new java.util.LinkedHashMap<>(Map.of(
                "id", userDetails.getId(),
                "username", userDetails.getUsername(),
                "email", userDetails.getEmail(),
                "role", userDetails.getRole(),
                "points", userDetails.getPoints(),
                "streak", effectiveStreak,
                "bio", userDetails.getBio() != null ? userDetails.getBio() : "",
                "createdAt", userDetails.getCreatedAt(),
                "hasVpnAccess", hasVpnAccess));
        ProfilePersonalizationDto appearance = userService.getPersonalization(userDetails.getId());
        userInfo.put("bio", appearance.bio());
        userInfo.put("tagline", appearance.tagline());
        userInfo.put("avatarSeed", appearance.avatarSeed());
        userInfo.put("interests", appearance.interests());
        userInfo.put("featuredBadgeIds", appearance.featuredBadgeIds());

        return ResponseEntity.ok(userInfo);
    }

    @GetMapping("/me/portfolio")
    public ResponseEntity<ProfilePortfolioDto> getMyPortfolio() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(userService.getProfilePortfolio(user.getId()));
    }

    @GetMapping("/{username}/portfolio")
    public ResponseEntity<ProfilePortfolioDto> getPortfolio(@PathVariable String username) {
        return ResponseEntity.ok(userService.getProfilePortfolio(userService.getUserIdByUsername(username)));
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

    @PatchMapping("/me/profile")
    public ResponseEntity<ProfilePersonalizationDto> updateProfile(@Valid @RequestBody UpdateProfileRequest request) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(userService.updateProfile(user.getId(), request));
    }

    @GetMapping("/ranking")
    public ResponseEntity<List<RankingEntry>> getRanking() {
        List<RankingEntry> ranking = userService.getTop10Ranking();
        return ResponseEntity.ok(ranking);
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

    @GetMapping("/me/stats")
    public ResponseEntity<ProfileStatsDto> getMyProfileStats() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(userService.getProfileStats(user.getId()));
    }

    @GetMapping("/{username}/stats")
    public ResponseEntity<ProfileStatsDto> getProfileStats(@PathVariable String username) {
        return ResponseEntity.ok(userService.getProfileStats(userService.getUserIdByUsername(username)));
    }

    @GetMapping("/me/recent-solved")
    public ResponseEntity<List<RecentSolvedRoomDto>> getMyRecentSolved(@RequestParam(defaultValue = "3") int limit) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        List<RecentSolvedRoomDto> recent = userService.getRecentSolvedRooms(user.getId(), limit);
        return ResponseEntity.ok(recent);
    }

    @GetMapping("/{username}/recent-solved")
    public ResponseEntity<List<RecentSolvedRoomDto>> getRecentSolved(
            @PathVariable String username, @RequestParam(defaultValue = "5") int limit) {
        Long userId = userService.getUserIdByUsername(username);
        return ResponseEntity.ok(userService.getRecentSolvedRooms(userId, limit));
    }

    @GetMapping("/me/active-time")
    public ResponseEntity<Map<String, Object>> getMyActiveTimeThisWeek() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        try {
            int seconds = userService.getActiveSecondsThisWeek(user.getId());
            return ResponseEntity.ok(Map.of("secondsThisWeek", seconds));
        } catch (RuntimeException e) {
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
