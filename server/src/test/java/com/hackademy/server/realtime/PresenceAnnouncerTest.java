package com.hackademy.server.realtime;

import com.hackademy.server.friendship.FriendshipRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PresenceAnnouncerTest {
    @Mock FriendshipRepository friendships;
    @Mock RealtimeNotifier realtime;
    @InjectMocks PresenceAnnouncer announcer;

    @Test
    void notifiesOnlyAcceptedFriends() {
        when(friendships.findAcceptedFriendIds(1L)).thenReturn(List.of(2L, 3L));

        announcer.announce(1L);

        verify(realtime).changed(2L, 3L);
    }

    @Test
    void staysQuietWithoutFriends() {
        when(friendships.findAcceptedFriendIds(1L)).thenReturn(List.of());

        announcer.announce(1L);

        verifyNoInteractions(realtime);
    }
}
