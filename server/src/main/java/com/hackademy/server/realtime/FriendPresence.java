package com.hackademy.server.realtime;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ScheduledFuture;

@Component
public class FriendPresence {
    private final TaskScheduler scheduler;
    private final PresenceAnnouncer announcer;
    private final Duration offlineGrace;
    private final Map<Long, Set<String>> sessions = new HashMap<>();
    private final Set<Long> online = new HashSet<>();
    private final Map<Long, ScheduledFuture<?>> pendingOffline = new HashMap<>();
    private final Map<Long, Long> rooms = new HashMap<>();
    private final Map<Long, LocalDateTime> lastSeen = new HashMap<>();
    private boolean closing;

    @EventListener(org.springframework.context.event.ContextClosedEvent.class)
    public synchronized void stop() {
        closing = true;
        pendingOffline.values().forEach(future -> future.cancel(false));
        pendingOffline.clear();
        sessions.clear();
        online.clear();
        rooms.clear();
    }

    public FriendPresence(@Qualifier("taskScheduler") TaskScheduler scheduler, PresenceAnnouncer announcer,
            @Value("${application.realtime.presence-offline-grace:5s}") Duration offlineGrace) {
        this.scheduler = scheduler;
        this.announcer = announcer;
        this.offlineGrace = offlineGrace;
    }

    @EventListener
    public void onConnected(SessionConnectedEvent event) {
        Long userId = userId(event.getUser());
        String sessionId = SimpMessageHeaderAccessor.getSessionId(event.getMessage().getHeaders());
        if (userId != null && sessionId != null) connected(userId, sessionId);
    }

    @EventListener
    public void onDisconnected(SessionDisconnectEvent event) {
        Long userId = userId(event.getUser());
        if (userId != null) disconnected(userId, event.getSessionId());
    }

    public synchronized boolean isOnline(Long userId) {
        return online.contains(userId);
    }

    public synchronized LocalDateTime lastSeen(Long userId) {
        return lastSeen.get(userId);
    }

    public synchronized Long roomOf(Long userId) {
        return online.contains(userId) ? rooms.get(userId) : null;
    }

    public void openRoom(Long userId, Long roomId) {
        boolean changed;
        synchronized (this) { changed = !roomId.equals(rooms.put(userId, roomId)); }
        if (changed) announcer.announce(userId);
    }

    public void closeRoom(Long userId, Long roomId) {
        boolean changed;
        synchronized (this) { changed = rooms.remove(userId, roomId); }
        if (changed) announcer.announce(userId);
    }

    synchronized void connected(Long userId, String sessionId) {
        if (closing) return;
        sessions.computeIfAbsent(userId, ignored -> new HashSet<>()).add(sessionId);
        var pending = pendingOffline.remove(userId);
        if (pending != null) pending.cancel(false);
        if (online.add(userId)) announcer.announce(userId);
    }

    synchronized void disconnected(Long userId, String sessionId) {
        if (closing) return;
        var open = sessions.get(userId);
        if (open == null || !open.remove(sessionId) || !open.isEmpty()) return;
        sessions.remove(userId);
        if (offlineGrace.isZero() || offlineGrace.isNegative()) {
            wentOffline(userId);
            return;
        }
        pendingOffline.put(userId, scheduler.schedule(() -> wentOffline(userId), Instant.now().plus(offlineGrace)));
    }

    synchronized void wentOffline(Long userId) {
        if (closing) return;
        pendingOffline.remove(userId);
        if (sessions.containsKey(userId)) return;
        rooms.remove(userId);
        if (!online.remove(userId)) return;
        lastSeen.put(userId, LocalDateTime.now());
        announcer.announce(userId);
    }

    private static Long userId(Principal principal) {
        if (principal == null) return null;
        try {
            return Long.valueOf(principal.getName());
        } catch (NumberFormatException exception) {
            return null;
        }
    }
}
