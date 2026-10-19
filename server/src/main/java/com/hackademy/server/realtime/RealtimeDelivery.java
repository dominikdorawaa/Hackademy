package com.hackademy.server.realtime;

import lombok.RequiredArgsConstructor;
import com.hackademy.server.user.AccountAccess;
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
    private final AccountAccess accounts;

    public record Envelope(String type, RealtimeState state) {}

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    @Async("realtimeExecutor")
    public void deliver(RealtimeChange change) {
        for (Long userId : change.userIds()) {
            String destination = userId.toString();
            if (users.getUser(destination) == null) continue;
            if (!accounts.isActive(userId)) continue;
            messaging.convertAndSendToUser(destination, "/queue/realtime", new Envelope("STATE", states.forUser(userId)));
        }
    }
}
