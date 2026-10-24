package com.hackademy.server.arena;

import com.hackademy.server.admin.PageResult;
import com.hackademy.server.arena.dto.ArenaQuestionAdminView;
import com.hackademy.server.arena.dto.ArenaQuestionRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/arena/questions")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class ArenaQuestionAdminController {

    private final ArenaQuestionAdminService questions;

    @GetMapping
    public PageResult<ArenaQuestionAdminView> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "") String category,
            @RequestParam(defaultValue = "") String difficulty
    ) {
        return PageResult.from(questions.page(page, size, query, category, difficulty));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ArenaQuestionAdminView create(@Valid @RequestBody ArenaQuestionRequest request) {
        return questions.create(request);
    }

    @PutMapping("/{id}")
    public ArenaQuestionAdminView update(@PathVariable Long id, @Valid @RequestBody ArenaQuestionRequest request) {
        return questions.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        questions.delete(id);
    }
}
