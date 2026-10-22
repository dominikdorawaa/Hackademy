package com.hackademy.server.dashboard;


import com.hackademy.server.user.User;
import com.hackademy.server.user.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;


@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardSummaryCache cache;
    private final DashboardSummaryReader reader;
    private final UserService userService;

    @GetMapping("/summary")
    public ResponseEntity<DashboardSummaryDto> getSummary() {
        var principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof User user)) return ResponseEntity.status(401).build();
        var summary = cache.getIfFresh(user.getId());
        if (summary == null) return ResponseEntity.ok(cache.load(user.getId(), () -> reader.read(user)));
        return ResponseEntity.ok(summary.toBuilder().activeSecondsThisWeek(userService.getActiveSecondsThisWeek(user.getId())).build());
    }
}
