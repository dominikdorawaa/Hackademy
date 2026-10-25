package com.hackademy.server.realtime;

import com.hackademy.server.friendship.FriendshipRepository;
import com.hackademy.server.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.scheduling.TaskScheduler;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PresenceAnnouncerTest {
    @Mock FriendshipRepository friendships;
    @Mock RealtimeNotifier realtime;
    @Mock UserRepository users;
    @Mock TaskScheduler scheduler;
    PresenceAnnouncer announcer;

    @BeforeEach
    void setUp() {
        announcer = new PresenceAnnouncer(friendships, realtime, users, scheduler, Duration.ZERO);
    }

    @Test
    void notifiesOnlyAcceptedFriendsWithoutTouchingLastSeen() {
        when(friendships.findAcceptedFriendIds(1L)).thenReturn(List.of(2L, 3L));

        announcer.announce(1L);

        verify(realtime).changed(2L, 3L);
        verifyNoInteractions(users);
    }

    @Test
    void staysQuietWithoutFriends() {
        when(friendships.findAcceptedFriendIds(1L)).thenReturn(List.of());

        announcer.announce(1L);

        verifyNoInteractions(realtime);
    }

    @Test
    void recordsTheVisitWhenUsersComeAndGo() {
        when(friendships.findAcceptedFriendIds(1L)).thenReturn(List.of(2L));

        announcer.cameOnline(1L);
        announcer.wentOffline(1L);

        verify(users, times(2)).markSeen(eq(1L), any());
        verify(realtime, times(2)).changed(2L);
    }

    @Test
    void savesEveryoneStillOnlineWhenTheServerStops() {
        announcer.stillOnlineAtShutdown(List.of(1L, 3L));

        verify(users).markSeen(eq(1L), any());
        verify(users).markSeen(eq(3L), any());
        verifyNoInteractions(realtime, friendships);
    }

    @Test
    void foldsQuickActivityChangesIntoOneUpdate() {
        announcer = new PresenceAnnouncer(friendships, realtime, users, scheduler, Duration.ofMillis(150));
        when(friendships.findAcceptedFriendIds(1L)).thenReturn(List.of(2L));

        announcer.activityChanged(new ActivityChange(Set.of(1L)));
        announcer.announce(1L);
        var flush = ArgumentCaptor.forClass(Runnable.class);
        verify(scheduler).schedule(flush.capture(), any(Instant.class));
        verifyNoInteractions(realtime);

        flush.getValue().run();
        verify(realtime).changed(2L);
        announcer.announce(1L);
        verify(scheduler, times(2)).schedule(any(Runnable.class), any(Instant.class));
    }
}
