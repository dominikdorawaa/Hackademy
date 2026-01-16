package com.hackademy.server.controller;

import com.hackademy.server.dto.BadgeDto;
import com.hackademy.server.model.User;
import com.hackademy.server.service.BadgeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/badges")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.PATCH, RequestMethod.DELETE, RequestMethod.OPTIONS})
public class BadgeController {

    private final BadgeService badgeService;

    @GetMapping("/me")
    public ResponseEntity<List<BadgeDto>> getMyBadges() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(badgeService.getUserBadges(user.getId()));
    }

    @GetMapping("/all")
    public ResponseEntity<List<BadgeDto>> getAllBadgesWithStatus() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return ResponseEntity.ok(badgeService.getAllBadgesWithStatus(user.getId()));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<BadgeDto>> getUserBadges(@PathVariable Long userId) {
        return ResponseEntity.ok(badgeService.getUserBadges(userId));
    }
}
