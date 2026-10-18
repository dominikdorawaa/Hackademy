package com.hackademy.server.chat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChatServiceImplTest {

    @Mock ChatMessageRepository chatMessageRepository;
    @InjectMocks ChatServiceImpl service;

    @Test
    void reportedMessagesStayAvailableForModeration() {
        var reported = ChatMessage.builder().id(5L).reported(true).build();
        when(chatMessageRepository.findByReportedTrueOrderByTimestampDesc()).thenReturn(List.of(reported));

        assertEquals(List.of(reported), service.getReportedMessages());
    }

    @Test
    void dismissingClearsTheReportedFlag() {
        var message = ChatMessage.builder().id(5L).reported(true).build();
        when(chatMessageRepository.findById(5L)).thenReturn(Optional.of(message));

        service.dismissReport(5L);

        assertFalse(message.isReported());
        verify(chatMessageRepository).save(message);
    }

    @Test
    void dismissingAnUnknownMessageDoesNothing() {
        when(chatMessageRepository.findById(5L)).thenReturn(Optional.empty());

        service.dismissReport(5L);

        verify(chatMessageRepository, never()).save(any());
    }

    @Test
    void deletingRemovesTheMessage() {
        service.deleteMessage(5L);

        verify(chatMessageRepository).deleteById(5L);
    }
}
