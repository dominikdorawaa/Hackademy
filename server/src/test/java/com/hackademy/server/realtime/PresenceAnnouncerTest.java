package com.hackademy.server.realtime;

import com.hackademy.server.friendship.FriendshipRepository;
import com.hackademy.server.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PresenceAnnouncerTest {
    @Mock FriendshipRepository friendships;
    @Mock RealtimeNotifier realtime;
    @Mock UserRepository users;
    @InjectMocks PresenceAnnouncer announcer;

    @Test
    void notifiesOnlyAcceptedFriends() {
        when(friendships.findAcceptedFriendIds(1L)).thenReturn(List.of(2L, 3L));

        announcer.announce(1L);

        verify(realtime).changed(2L, 3L);
        verify(users).markSeen(eq(1L), any());
    }

    @Test
    void announcesEveryoneWhoseActivityChanged() {
        when(friendships.findAcceptedFriendIds(1L)).thenReturn(List.of(2L));
        when(friendships.findAcceptedFriendIds(3L)).thenReturn(List.of());

        announcer.activityChanged(new ActivityChange(java.util.Set.of(1L, 3L)));

        verify(realtime).changed(2L);
        verify(users, times(2)).markSeen(any(), any());
    }

    @Test
    void staysQuietWithoutFriends() {
        when(friendships.findAcceptedFriendIds(1L)).thenReturn(List.of());

        announcer.announce(1L);

        verifyNoInteractions(realtime);
    }
}
