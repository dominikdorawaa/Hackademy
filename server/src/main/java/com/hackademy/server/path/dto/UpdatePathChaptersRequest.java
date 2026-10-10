package com.hackademy.server.path.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record UpdatePathChaptersRequest(
    @NotEmpty(message = "Ścieżka musi mieć co najmniej jeden rozdział") List<@NotNull(message = "Rozdział nie może być pusty") @Valid ChapterRequest> chapters
) {}
