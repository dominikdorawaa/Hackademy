package com.hackademy.server.realtime;

import com.hackademy.server.friendship.FriendshipRepository;
import com.hackademy.server.user.UserRepository;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class PresenceAnnouncer {
    private final FriendshipRepository friendships;
    private final RealtimeNotifier realtime;
    private final UserRepository users;
    private final TaskScheduler scheduler;
    private final Duration coalesce;
    private final Set<Long> queued = ConcurrentHashMap.newKeySet();

    public PresenceAnnouncer(FriendshipRepository friendships, RealtimeNotifier realtime, UserRepository users,
            @Qualifier("taskScheduler") TaskScheduler scheduler,
            @Value("${application.realtime.presence-coalesce:150ms}") Duration coalesce) {
        this.friendships = friendships;
        this.realtime = realtime;
        this.users = users;
        this.scheduler = scheduler;
        this.coalesce = coalesce;
    }

    public void announce(Long userId) {
        if (coalesce.isZero() || coalesce.isNegative()) {
            notifyFriends(userId);
            return;
        }
        if (queued.add(userId)) scheduler.schedule(() -> {
            queued.remove(userId);
            notifyFriends(userId);
        }, Instant.now().plus(coalesce));
    }

    @Async("realtimeExecutor")
    public void cameOnline(Long userId) {
        users.markSeen(userId, LocalDateTime.now());
        announce(userId);
    }

    @Async("realtimeExecutor")
    public void wentOffline(Long userId) {
        users.markSeen(userId, LocalDateTime.now());
        announce(userId);
    }

    public void stillOnlineAtShutdown(Collection<Long> userIds) {
        var now = LocalDateTime.now();
        for (Long userId : userIds) {
            try { users.markSeen(userId, now); }
            catch (RuntimeException ignored) { return; }
        }
    }

    @EventListener
    public void activityChanged(ActivityChange change) {
        change.userIds().forEach(this::announce);
    }

    private void notifyFriends(Long userId) {
        var friendIds = friendships.findAcceptedFriendIds(userId);
        if (!friendIds.isEmpty()) realtime.changed(friendIds.toArray(Long[]::new));
    }
}
