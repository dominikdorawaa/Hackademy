package com.hackademy.server.realtime;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

@RestController
@RequiredArgsConstructor
public class RealtimeController {
    private final RealtimeStateService states;

    @GetMapping("/api/realtime/state")
    public RealtimeState state(Principal principal) {
        return states.forUser(principal.getName());
    }

}
