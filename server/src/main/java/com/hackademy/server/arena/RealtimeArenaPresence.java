package com.hackademy.server.arena;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class RealtimeArenaPresence implements ArenaPresence {
    private final SimpUserRegistry users;

    @Override
    public boolean isConnected(Long userId) {
        return users.getUser(userId.toString()) != null;
    }
}
