package com.hackademy.server.realtime;

import com.hackademy.server.friendship.FriendshipRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PresenceAnnouncer {
    private final FriendshipRepository friendships;
    private final RealtimeNotifier realtime;

    @Async("realtimeExecutor")
    public void announce(Long userId) {
        var friendIds = friendships.findAcceptedFriendIds(userId);
        if (!friendIds.isEmpty()) realtime.changed(friendIds.toArray(Long[]::new));
    }
}
