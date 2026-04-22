package com.hackademy.server.controller;

import com.hackademy.server.dto.PathDetailDto;
import com.hackademy.server.dto.PathProgressDto;
import com.hackademy.server.dto.PathRoomsMiniResponse;
import com.hackademy.server.dto.PathSummaryDto;
import com.hackademy.server.service.PathService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/paths")
@RequiredArgsConstructor
public class PathController {

    private final PathService pathService;

    // ── helpers ─────────────────────────────────────────────────────────────

    private String currentUsername() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UserDetails ud) return ud.getUsername();
        return null;
    }

    // ── public endpoints ─────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<List<PathSummaryDto>> listPaths() {
        return ResponseEntity.ok(pathService.listPaths(currentUsername()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PathDetailDto> getPath(@PathVariable Long id) {
        return ResponseEntity.ok(pathService.getPathDetail(id, currentUsername()));
    }

    @GetMapping("/{id}/rooms-mini")
    public ResponseEntity<PathRoomsMiniResponse> getPathRoomsMini(
            @PathVariable Long id,
            @RequestParam(name = "limit", defaultValue = "5") int limit
    ) {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        String username = null;
        if (principal instanceof UserDetails) {
            username = ((UserDetails) principal).getUsername();
        }
        return ResponseEntity.ok(pathService.getPathRoomsMini(id, username, limit));
    }

    @GetMapping("/me/progress")
    public ResponseEntity<List<PathProgressDto>> myProgress() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        String username = null;
        if (principal instanceof UserDetails) {
            username = ((UserDetails) principal).getUsername();
        }
        return ResponseEntity.ok(pathService.getMyPathsProgress(username));
    }

    @GetMapping("/{id}/banner")
    public ResponseEntity<byte[]> getPathBanner(@PathVariable Long id) {
        byte[] data = pathService.getBannerData(id);
        if (data == null || data.length == 0) {
            return ResponseEntity.notFound().build();
        }
        String mime = pathService.getBannerMime(id);
        MediaType mt = (mime != null && !mime.isBlank()) ? MediaType.parseMediaType(mime) : MediaType.APPLICATION_OCTET_STREAM;
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=3600")
                .contentType(mt)
                .body(data);
    }

    // ── enrollment endpoints ─────────────────────────────────────────────────

    @PostMapping("/{id}/enroll")
    public ResponseEntity<Void> enroll(@PathVariable Long id) {
        String username = currentUsername();
        if (username == null) return ResponseEntity.status(401).build();
        pathService.enrollUser(id, username);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}/enroll")
    public ResponseEntity<Void> unenroll(@PathVariable Long id) {
        String username = currentUsername();
        if (username == null) return ResponseEntity.status(401).build();
        pathService.unenrollUser(id, username);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}/enrolled")
    public ResponseEntity<Boolean> checkEnrolled(@PathVariable Long id) {
        String username = currentUsername();
        return ResponseEntity.ok(pathService.isEnrolled(id, username));
    }
}
