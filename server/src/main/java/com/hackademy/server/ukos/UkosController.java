package com.hackademy.server.ukos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ukos/lab-1")
@RequiredArgsConstructor
public class UkosController {
    private final UkosService service;
    public record ProgressRequest(@NotNull @Min(0) @Max(15) Integer completedSteps) {}

    @GetMapping
    public UkosService.State state(Authentication auth) {
        return service.state(auth.getName());
    }

    @PutMapping("/progress")
    public UkosService.State progress(Authentication auth, @RequestBody @Valid ProgressRequest request) {
        return service.progress(auth.getName(), request.completedSteps());
    }
}
