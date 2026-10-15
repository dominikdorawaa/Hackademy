package com.hackademy.server.chat;

import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChatServiceImplTest {

    @Mock ChatMessageRepository chatMessageRepository;
    @Mock UserRepository userRepository;
    @InjectMocks ChatServiceImpl service;

    @Test
    void mutedUserCannotSendMessages() {
        var user = User.builder().id(1L).mutedUntil(LocalDateTime.now(ZoneOffset.UTC).plusMinutes(5)).build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        assertThrows(IllegalStateException.class, () -> service.sendMessage("g", 1L, "alice", "hej"));
        verify(chatMessageRepository, never()).save(any());
    }

    @Test
    void userWithoutActiveMuteSendsMessage() {
        var expired = User.builder().id(1L).mutedUntil(LocalDateTime.now(ZoneOffset.UTC).minusMinutes(5)).build();
        var neverMuted = User.builder().id(2L).build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(expired));
        when(userRepository.findById(2L)).thenReturn(Optional.of(neverMuted));
        when(chatMessageRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var sent = service.sendMessage("g", 1L, "alice", "hej");
        service.sendMessage("g", 2L, "bob", "cześć");

        assertEquals("g", sent.getGameId());
        assertEquals(1L, sent.getSenderId());
        assertEquals("alice", sent.getSenderUsername());
        assertEquals("hej", sent.getContent());
        assertFalse(sent.isReported());
        verify(chatMessageRepository, times(2)).save(any());
    }

    @Test
    void unknownSenderCannotSendMessages() {
        when(userRepository.findById(1L)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class, () -> service.sendMessage("g", 1L, "alice", "hej"));
    }

    @Test
    void reportingAndDismissingToggleReportedFlag() {
        var message = ChatMessage.builder().id(5L).build();
        when(chatMessageRepository.findById(5L)).thenReturn(Optional.of(message));

        service.reportMessage(5L);
        assertTrue(message.isReported());

        service.dismissReport(5L);
        assertFalse(message.isReported());
        verify(chatMessageRepository, times(2)).save(message);
    }

    @Test
    void reportingUnknownMessageDoesNothing() {
        when(chatMessageRepository.findById(5L)).thenReturn(Optional.empty());

        service.reportMessage(5L);
        service.dismissReport(5L);

        verify(chatMessageRepository, never()).save(any());
    }

    @Test
    void cleanupKeepsReportedMessages() {
        service.cleanupChat("g");

        verify(chatMessageRepository).deleteByGameIdAndReportedFalse("g");
        verifyNoMoreInteractions(chatMessageRepository);
    }

    @Test
    void delegatesQueriesAndDeletionToRepository() {
        var messages = List.of(ChatMessage.builder().id(1L).build());
        when(chatMessageRepository.findByGameIdOrderByTimestampAsc("g")).thenReturn(messages);
        when(chatMessageRepository.findByReportedTrueOrderByTimestampDesc()).thenReturn(messages);

        assertSame(messages, service.getMessages("g"));
        assertSame(messages, service.getReportedMessages());
        service.deleteMessage(1L);

        verify(chatMessageRepository).deleteById(1L);
    }
}
