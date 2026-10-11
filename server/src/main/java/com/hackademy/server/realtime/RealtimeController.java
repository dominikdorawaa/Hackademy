package com.hackademy.server.realtime;

import com.hackademy.server.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class RealtimeController {
    private final RealtimeStateService states;

    @GetMapping("/api/realtime/state")
    public RealtimeState state(@AuthenticationPrincipal User user) {
        return states.forUser(user.getId());
    }

}
