package com.hackademy.server.user;

import com.hackademy.server.badge.UserBadgeRepository;
import com.hackademy.server.clerk.ClerkProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AccountDeletionServiceTest {

    @Mock UserRepository users;
    @Mock AccountDeletionRepository deletions;
    @Mock UserBadgeRepository badges;
    @Mock PlatformTransactionManager transactions;
    @Mock ApplicationEventPublisher events;
    private AccountDeletionService service;

    @BeforeEach
    void createService() {
        service = new AccountDeletionService(users, deletions, badges,
                new ClerkProperties("https://example.clerk.accounts.dev", null, null, null),
                RestClient.builder(), events, transactions);
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

    @Test
    void theLastAdministratorCannotBeDeleted() {
        when(users.findByIdForUpdate(1L)).thenReturn(Optional.of(User.builder().id(1L).role(Role.ADMIN).build()));
        when(users.findByRoleForUpdate(Role.ADMIN)).thenReturn(List.of(User.builder().id(1L).role(Role.ADMIN).build()));
        var exception = assertThrows(ResponseStatusException.class, () -> service.delete(1L));
        assertEquals(409, exception.getStatusCode().value());
        verify(deletions, never()).saveAndFlush(any());
        verifyNoInteractions(events);
    }

    @Test
    void anotherAdministratorKeepsDeletionPossible() {
        when(users.findByIdForUpdate(1L)).thenReturn(Optional.of(User.builder().id(1L).role(Role.ADMIN).build()));
        when(users.findByRoleForUpdate(Role.ADMIN)).thenReturn(List.of(User.builder().id(1L).role(Role.ADMIN).build(), User.builder().id(2L).role(Role.ADMIN).build()));
        when(deletions.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        service.delete(1L);
        verify(events).publishEvent(new AccountBlockedEvent(1L));
        verify(users).delete(any());
    }

    @Test
    void anAdministratorWhoseDeletionIsPendingDoesNotCountAsAnother() {
        var admin = User.builder().id(1L).role(Role.ADMIN).build();
        when(users.findByIdForUpdate(1L)).thenReturn(Optional.of(admin));
        when(users.findByRoleForUpdate(Role.ADMIN)).thenReturn(List.of(admin, User.builder().id(2L).role(Role.ADMIN).build()));
        when(deletions.existsById(anyLong())).thenAnswer(invocation -> invocation.getArgument(0).equals(2L));
        var exception = assertThrows(ResponseStatusException.class, () -> service.delete(1L));
        assertEquals(409, exception.getStatusCode().value());
        verify(deletions, never()).saveAndFlush(any());
    }

    @Test
    void pendingDeletionsAreCompletedInTheBackground() {
        when(deletions.findPending()).thenReturn(List.of(new AccountDeletion(1L, null)));
        when(users.findByIdForUpdate(1L)).thenReturn(Optional.of(User.builder().id(1L).build()));
        service.completePending();
        verify(events).publishEvent(new AccountBlockedEvent(1L));
        verify(users).delete(any());
    }

    @Test
    void aFailingArenaCleanupDoesNotStopTheDeletion() {
        when(users.findByIdForUpdate(1L)).thenReturn(Optional.of(User.builder().id(1L).build()));
        when(deletions.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        doThrow(new IllegalStateException("arena")).when(events).publishEvent(any(Object.class));
        service.delete(1L);
        verify(users).delete(any());
    }
}
