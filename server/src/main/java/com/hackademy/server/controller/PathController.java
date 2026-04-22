package com.hackademy.server.controller;

import com.hackademy.server.dto.PathDetailDto;
import com.hackademy.server.dto.PathSummaryDto;
import com.hackademy.server.service.PathService;
import lombok.RequiredArgsConstructor;
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
}

