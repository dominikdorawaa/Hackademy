package com.hackademy.server.user;

import com.hackademy.server.badge.UserBadgeRepository;
import com.hackademy.server.clerk.ClerkProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AccountDeletionServiceTest {

    @Mock UserRepository users;
    @Mock AccountDeletionRepository deletions;
    @Mock UserBadgeRepository badges;
    @Mock PlatformTransactionManager transactions;
    private AccountDeletionService service;

    @BeforeEach
    void createService() {
        service = new AccountDeletionService(users, deletions, badges,
                new ClerkProperties("https://example.clerk.accounts.dev", null, null, null),
                RestClient.builder(), transactions);
    }

    @Test
    void missingSecretDoesNotStartDeletion() {
        when(users.findByIdForUpdate(1L)).thenReturn(Optional.of(User.builder().id(1L).clerkUserId("user_1").build()));
        var exception = assertThrows(ResponseStatusException.class, () -> service.delete(1L));
        assertEquals(503, exception.getStatusCode().value());
        verify(deletions, never()).saveAndFlush(any());
        verify(users, never()).delete(any());
    }

    @Test
    void retryCannotDeleteAnAccountWhoseIdentityChanged() {
        when(users.findByIdForUpdate(1L)).thenReturn(Optional.of(User.builder().id(1L).clerkUserId("user_new").build()));
        when(deletions.findById(1L)).thenReturn(Optional.of(new AccountDeletion(1L, null)));
        assertThrows(IllegalStateException.class, () -> service.delete(1L));
        verify(users, never()).delete(any());
        verifyNoInteractions(badges);
    }
}
