package com.hackademy.server.realtime;

import com.hackademy.server.user.AccountAccess;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.user.SimpUser;
import org.springframework.messaging.simp.user.SimpUserRegistry;

import java.util.Set;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RealtimeDeliveryTest {

    @Mock RealtimeStateService states;
    @Mock SimpMessagingTemplate messaging;
    @Mock SimpUserRegistry users;
    @Mock AccountAccess accounts;
    @InjectMocks RealtimeDelivery delivery;

    @Test
    void deletedAccountsReceiveNoProtectedRealtimeDataOnExistingSubscriptions() {
        when(users.getUser("1")).thenReturn(mock(SimpUser.class));
        when(accounts.isActive(1L)).thenReturn(false);
        delivery.deliver(new RealtimeChange(Set.of(1L)));
        verifyNoInteractions(states, messaging);
    }

    @Test
    void activeAccountsStillReceiveState() {
        when(users.getUser("1")).thenReturn(mock(SimpUser.class));
        when(accounts.isActive(1L)).thenReturn(true);
        delivery.deliver(new RealtimeChange(Set.of(1L)));
        verify(states).forUser(1L);
        verify(messaging).convertAndSendToUser("1", "/queue/realtime", new RealtimeDelivery.Envelope("STATE", null));
    }

    @Test
    void offlineAccountsNeedNoState() {
        delivery.deliver(new RealtimeChange(Set.of(1L)));
        verifyNoInteractions(states, messaging, accounts);
    }
}
