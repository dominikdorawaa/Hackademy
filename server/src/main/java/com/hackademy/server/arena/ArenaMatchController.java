package com.hackademy.server.arena;

import com.hackademy.server.arena.dto.ArenaMatchDetail;
import com.hackademy.server.arena.dto.ArenaMatchPage;
import com.hackademy.server.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/arena/matches")
@RequiredArgsConstructor
public class ArenaMatchController {
    private final ArenaHistory history;

    private static Long currentUserId() {
        return ((User) SecurityContextHolder.getContext().getAuthentication().getPrincipal()).getId();
    }

    @GetMapping
    public ArenaMatchPage list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return history.page(currentUserId(), page, size);
    }

    @GetMapping("/{matchId}")
    public ResponseEntity<ArenaMatchDetail> detail(@PathVariable Long matchId) {
        return ResponseEntity.of(history.detail(currentUserId(), matchId));
    }

    @GetMapping("/game/{gameId}")
    public ResponseEntity<ArenaMatchDetail> detailOfGame(@PathVariable String gameId) {
        return ResponseEntity.of(history.detailOfGame(currentUserId(), gameId));
    }
}
