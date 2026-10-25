package com.hackademy.server.realtime;

import com.hackademy.server.friendship.FriendshipRepository;
import com.hackademy.server.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class PresenceAnnouncer {
    private final FriendshipRepository friendships;
    private final RealtimeNotifier realtime;
    private final UserRepository users;

    @Async("realtimeExecutor")
    public void announce(Long userId) {
        users.markSeen(userId, LocalDateTime.now());
        var friendIds = friendships.findAcceptedFriendIds(userId);
        if (!friendIds.isEmpty()) realtime.changed(friendIds.toArray(Long[]::new));
    }

    @Async("realtimeExecutor")
    @EventListener
    public void activityChanged(ActivityChange change) {
        change.userIds().forEach(this::announce);
    }
}
