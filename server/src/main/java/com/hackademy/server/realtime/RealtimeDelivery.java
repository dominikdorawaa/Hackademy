package com.hackademy.server.realtime;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Async;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class RealtimeDelivery {
    private final RealtimeStateService states;
    private final SimpMessagingTemplate messaging;
    private final SimpUserRegistry users;

    public record Envelope(String type, RealtimeState state) {}

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    @Async("realtimeExecutor")
    public void deliver(RealtimeChange change) {
        for (String username : change.usernames()) {
            if (users.getUser(username) == null) continue;
            messaging.convertAndSendToUser(username, "/queue/realtime", new Envelope("STATE", states.forUser(username)));
        }
    }
}
