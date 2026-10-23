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
    @Mock org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor realtimeExecutor;

    @org.junit.jupiter.api.BeforeEach
    void executeDelivery() {
        lenient().doAnswer(invocation -> { ((Runnable) invocation.getArgument(0)).run(); return null; }).when(realtimeExecutor).execute(any(Runnable.class));
    }
    @InjectMocks RealtimeDelivery delivery;

    @Test
    void deletedAccountsReceiveNoProtectedRealtimeDataOnExistingSubscriptions() {
        when(users.getUser("1")).thenReturn(mock(SimpUser.class));
        when(accounts.isActive(1L)).thenReturn(false);
        delivery.deliver(new RealtimeChange(Set.of(1L), false));
        delivery.flush();
        verifyNoInteractions(states, messaging);
    }

    @Test
    void activeAccountsStillReceiveState() {
        when(users.getUser("1")).thenReturn(mock(SimpUser.class));
        when(accounts.isActive(1L)).thenReturn(true);
        delivery.deliver(new RealtimeChange(Set.of(1L), false));
        delivery.flush();
        verify(states).forUser(1L);
        verify(messaging).convertAndSendToUser("1", "/queue/realtime", new RealtimeDelivery.Envelope("STATE", null));
    }

    @Test
    void offlineAccountsNeedNoState() {
        delivery.deliver(new RealtimeChange(Set.of(1L), false));
        delivery.flush();
        verifyNoInteractions(states, messaging, accounts);
    }

    @Test
    void coalescesUpdatesAndRetriesWhenDeliveryCapacityIsFull() {
        when(users.getUser("1")).thenReturn(mock(SimpUser.class));
        when(accounts.isActive(1L)).thenReturn(true);
        for (int i = 0; i < 100; i++) delivery.deliver(new RealtimeChange(Set.of(1L)));
        doThrow(new org.springframework.core.task.TaskRejectedException("full"))
                .doAnswer(invocation -> { ((Runnable) invocation.getArgument(0)).run(); return null; })
                .when(realtimeExecutor).execute(any(Runnable.class));
        delivery.flush();
        verify(states, never()).forUser(1L);
        delivery.flush();
        verify(states).forUser(1L);
    }

    @Test
    void overflowRequestsResynchronizationInsteadOfGrowingTheQueue() {
        when(users.getUser(anyString())).thenReturn(mock(SimpUser.class));
        for (long id = 1; id <= 1025; id++) delivery.deliver(new RealtimeChange(Set.of(id), false));
        verify(messaging).convertAndSendToUser("1025", "/queue/realtime", new RealtimeDelivery.Envelope("READY", null));
        delivery.flush();
        verify(realtimeExecutor, times(32)).execute(any(Runnable.class));
    }
}
