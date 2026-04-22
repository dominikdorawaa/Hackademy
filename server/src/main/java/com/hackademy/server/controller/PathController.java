package com.hackademy.server.controller;

import com.hackademy.server.dto.PathDetailDto;
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

    @GetMapping
    public ResponseEntity<List<PathSummaryDto>> listPaths() {
        return ResponseEntity.ok(pathService.listPaths());
    }

    @GetMapping("/{id}")
    public ResponseEntity<PathDetailDto> getPath(@PathVariable Long id) {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        String username = null;
        if (principal instanceof UserDetails) {
            username = ((UserDetails) principal).getUsername();
        }
        return ResponseEntity.ok(pathService.getPathDetail(id, username));
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
}

