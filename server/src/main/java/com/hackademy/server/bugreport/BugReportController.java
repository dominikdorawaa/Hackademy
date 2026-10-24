package com.hackademy.server.bugreport;

import com.hackademy.server.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping(BugReportController.PATH)
@RequiredArgsConstructor
public class BugReportController {

    public static final String PATH = "/api/bug-reports";

    private final BugReportService bugReports;

    @PostMapping
    public ResponseEntity<Map<String, String>> submit(@RequestBody BugReportRequest request) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        bugReports.submit(user.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("message", "Dziękujemy! Zgłoszenie trafiło do zespołu."));
    }

    @ExceptionHandler(BugReportLimitException.class)
    public ResponseEntity<Map<String, Object>> limited(BugReportLimitException exception) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, Long.toString(exception.retryAfterSeconds()))
                .body(Map.of("message", exception.getMessage(), "retryAfter", exception.retryAfterSeconds()));
    }
}
