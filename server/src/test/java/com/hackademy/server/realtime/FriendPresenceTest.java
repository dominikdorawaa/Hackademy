package com.hackademy.server.realtime;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ScheduledFuture;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FriendPresenceTest {
    @Mock TaskScheduler scheduler;
    @Mock PresenceAnnouncer announcer;
    @Mock ScheduledFuture<Object> future;
    FriendPresence presence;

    @BeforeEach
    void setUp() {
        presence = new FriendPresence(scheduler, announcer, Duration.ofSeconds(5));
    }

    private Runnable scheduledOffline() {
        var task = ArgumentCaptor.forClass(Runnable.class);
        verify(scheduler).schedule(task.capture(), any(Instant.class));
        return task.getValue();
    }

    private void scheduleReturnsFuture() {
        doReturn(future).when(scheduler).schedule(any(Runnable.class), any(Instant.class));
    }

    @Test
    void firstTabAnnouncesOnlineAndFurtherTabsStayQuiet() {
        presence.connected(1L, "a");
        presence.connected(1L, "b");

        assertTrue(presence.isOnline(1L));
        verify(announcer, times(1)).announce(1L);
    }

    @Test
    void closingOneOfTwoTabsKeepsUserOnline() {
        presence.connected(1L, "a");
        presence.connected(1L, "b");
        presence.disconnected(1L, "a");

        assertTrue(presence.isOnline(1L));
        verifyNoInteractions(scheduler);
        verify(announcer, times(1)).announce(1L);
    }

    @Test
    void closingAllTabsGoesOfflineAfterGrace() {
        scheduleReturnsFuture();
        presence.connected(1L, "a");
        presence.connected(1L, "b");
        presence.disconnected(1L, "a");
        presence.disconnected(1L, "b");

        assertTrue(presence.isOnline(1L));
        scheduledOffline().run();

        assertFalse(presence.isOnline(1L));
        verify(announcer, times(2)).announce(1L);
    }

    @Test
    void reconnectingDuringGraceCancelsOffline() {
        scheduleReturnsFuture();
        presence.connected(1L, "a");
        presence.disconnected(1L, "a");
        presence.connected(1L, "b");

        verify(future).cancel(false);
        assertTrue(presence.isOnline(1L));
        verify(announcer, times(1)).announce(1L);
    }

    @Test
    void staleOfflineCheckDoesNothingWhileASessionIsOpen() {
        scheduleReturnsFuture();
        presence.connected(1L, "a");
        presence.disconnected(1L, "a");
        var check = scheduledOffline();
        presence.connected(1L, "b");

        check.run();

        assertTrue(presence.isOnline(1L));
        verify(announcer, times(1)).announce(1L);
    }

    @Test
    void zeroGraceGoesOfflineImmediately() {
        presence = new FriendPresence(scheduler, announcer, Duration.ZERO);
        presence.connected(1L, "a");
        presence.disconnected(1L, "a");

        assertFalse(presence.isOnline(1L));
        verifyNoInteractions(scheduler);
        verify(announcer, times(2)).announce(1L);
    }

    @Test
    void unknownOrRepeatedDisconnectsAreIgnored() {
        presence.disconnected(1L, "a");
        presence.connected(1L, "a");
        presence.disconnected(1L, "other");

        assertTrue(presence.isOnline(1L));
        verifyNoInteractions(scheduler);
    }

    @Test
    void usersAreTrackedIndependently() {
        presence.connected(1L, "a");

        assertTrue(presence.isOnline(1L));
        assertFalse(presence.isOnline(2L));
        verify(announcer, never()).announce(2L);
    }

    @Test
    void readsUserAndSessionFromStompEvents() {
        presence = new FriendPresence(scheduler, announcer, Duration.ZERO);
        Principal user = () -> "7";
        presence.onConnected(new SessionConnectedEvent(this, message("s1"), user));
        assertTrue(presence.isOnline(7L));

        presence.onDisconnected(new SessionDisconnectEvent(this, message("s1"), "s1", CloseStatus.NORMAL, user));
        assertFalse(presence.isOnline(7L));
    }

    @Test
    void ignoresEventsWithoutNumericPrincipal() {
        presence.onConnected(new SessionConnectedEvent(this, message("s1"), null));
        presence.onConnected(new SessionConnectedEvent(this, message("s2"), () -> "alice"));
        presence.onDisconnected(new SessionDisconnectEvent(this, message("s1"), "s1", CloseStatus.NORMAL, null));

        verifyNoInteractions(announcer);
    }

    private static Message<byte[]> message(String sessionId) {
        var headers = SimpMessageHeaderAccessor.create();
        headers.setSessionId(sessionId);
        return MessageBuilder.createMessage(new byte[0], headers.getMessageHeaders());
    }
}
