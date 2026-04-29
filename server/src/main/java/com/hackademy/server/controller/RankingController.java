package com.hackademy.server.controller;

import com.hackademy.server.dto.RankingEntry;
import com.hackademy.server.dto.RankingSummaryDto;
import com.hackademy.server.model.User;
import com.hackademy.server.service.UserService;
import com.hackademy.server.service.UserServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ranking")
@RequiredArgsConstructor
public class RankingController {

    private final UserService userService;
    private final UserServiceImpl userServiceImpl;

    @GetMapping("/summary")
    public ResponseEntity<RankingSummaryDto> summary() {
        List<RankingEntry> ranking = userService.getTop10Ranking();

        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof User user)) {
            return ResponseEntity.ok(RankingSummaryDto.builder()
                    .ranking(ranking)
                    .build());
        }

        int effectiveStreak = user.getStreak();
        LocalDate lastSolved = user.getLastSolvedDate();
        LocalDate today = LocalDate.now();
        if (lastSolved != null && lastSolved.isBefore(today.minusDays(1))) {
            effectiveStreak = 0;
        }

        Map<String, Object> userInfo = Map.of(
                "id", user.getId(),
                "username", user.getUsername(),
                "email", user.getEmail(),
                "role", user.getRole(),
                "points", user.getPoints(),
                "streak", effectiveStreak,
                "bio", user.getBio() != null ? user.getBio() : "",
                "createdAt", user.getCreatedAt()
        );

        RankingEntry myRank = userServiceImpl.getUserRankFast(user.getId(), user.getUsername(), user.getPoints(), user.getElo());

        return ResponseEntity.ok(RankingSummaryDto.builder()
                .ranking(ranking)
                .user(userInfo)
                .myRank(myRank)
                .build());
    }
}

