package com.hackademy.server.realtime;

import com.github.benmanes.caffeine.cache.Cache;
import com.hackademy.server.cache.LocalCaches;
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
import java.util.LinkedHashMap;
import java.util.List;
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
    private static final int TABS_PER_USER = 16;

    private final Map<Long, LinkedHashMap<String, Long>> rooms = new HashMap<>();
    private final Cache<Long, LocalDateTime> lastSeen = LocalCaches.bounded(10_000, Duration.ofMinutes(2));
    private boolean closing;

    @EventListener(org.springframework.context.event.ContextClosedEvent.class)
    public void stop() {
        List<Long> stillOnline;
        synchronized (this) {
            closing = true;
            pendingOffline.values().forEach(future -> future.cancel(false));
            pendingOffline.clear();
            stillOnline = List.copyOf(online);
            sessions.clear();
            online.clear();
            rooms.clear();
        }
        lastSeen.invalidateAll();
        announcer.stillOnlineAtShutdown(stillOnline);
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

    public LocalDateTime lastSeen(Long userId) {
        return lastSeen.getIfPresent(userId);
    }

    public synchronized Long roomOf(Long userId) {
        return online.contains(userId) ? latestRoom(userId) : null;
    }

    public void openRoom(Long userId, String tab, Long roomId) {
        boolean changed;
        synchronized (this) {
            if (closing || !online.contains(userId)) return;
            Long before = latestRoom(userId);
            var tabs = rooms.computeIfAbsent(userId, ignored -> new LinkedHashMap<>());
            tabs.remove(tab);
            tabs.put(tab, roomId);
            if (tabs.size() > TABS_PER_USER) tabs.remove(tabs.keySet().iterator().next());
            changed = !roomId.equals(before);
        }
        if (changed) announcer.announce(userId);
    }

    public void closeRoom(Long userId, String tab, Long roomId) {
        boolean changed;
        synchronized (this) {
            var tabs = rooms.get(userId);
            if (tabs == null) return;
            Long before = latestRoom(userId);
            if (!tabs.remove(tab, roomId)) return;
            if (tabs.isEmpty()) rooms.remove(userId);
            changed = !java.util.Objects.equals(before, latestRoom(userId));
        }
        if (changed) announcer.announce(userId);
    }

    private Long latestRoom(Long userId) {
        var tabs = rooms.get(userId);
        if (tabs == null || tabs.isEmpty()) return null;
        Long latest = null;
        for (Long room : tabs.values()) latest = room;
        return latest;
    }

    synchronized void connected(Long userId, String sessionId) {
        if (closing) return;
        sessions.computeIfAbsent(userId, ignored -> new HashSet<>()).add(sessionId);
        var pending = pendingOffline.remove(userId);
        if (pending != null) pending.cancel(false);
        if (!online.add(userId)) return;
        lastSeen.invalidate(userId);
        announcer.cameOnline(userId);
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
        announcer.wentOffline(userId);
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
