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
    private final org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor realtimeExecutor;
    private final java.util.Set<Long> pending = new java.util.LinkedHashSet<>();

    public record Envelope(String type, RealtimeState state) {}

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void deliver(RealtimeChange change) {
        for (Long userId : change.userIds()) {
            if (change.social()) states.invalidateSocial(userId);
            if (users.getUser(userId.toString()) != null) enqueue(userId);
        }
    }

    private void enqueue(Long userId) {
        synchronized (pending) {
            if (pending.contains(userId)) return;
            if (pending.size() < 1024) { pending.add(userId); return; }
        }
        messaging.convertAndSendToUser(userId.toString(), "/queue/realtime", new Envelope("READY", null));
    }

    @org.springframework.scheduling.annotation.Scheduled(fixedDelay = 50)
    public void flush() {
        for (int count = 0; count < 32; count++) {
            Long userId;
            synchronized (pending) {
                var iterator = pending.iterator();
                if (!iterator.hasNext()) return;
                userId = iterator.next();
                iterator.remove();
            }
            try { realtimeExecutor.execute(() -> send(userId)); }
            catch (org.springframework.core.task.TaskRejectedException full) { enqueue(userId); return; }
        }
    }

    private void send(Long userId) {
        try {
            String destination = userId.toString();
            if (users.getUser(destination) == null) return;
            if (!accounts.isActive(userId)) return;
            messaging.convertAndSendToUser(destination, "/queue/realtime", new Envelope("STATE", states.forUser(userId)));
        } catch (RuntimeException unavailable) { enqueue(userId); }
    }
}
