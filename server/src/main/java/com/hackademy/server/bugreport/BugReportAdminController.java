package com.hackademy.server.bugreport;

import com.hackademy.server.admin.PageResult;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/bug-reports")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class BugReportAdminController {

    private final BugReportService bugReports;

    public record StatusRequest(String status) {
    }

    @GetMapping
    public PageResult<BugReportView> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(defaultValue = "") String status
    ) {
        return PageResult.from(bugReports.page(page, size, status));
    }

    @PutMapping("/{id}/status")
    public BugReportView updateStatus(@PathVariable Long id, @RequestBody StatusRequest request) {
        return bugReports.updateStatus(id, request.status());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        bugReports.delete(id);
    }
}
