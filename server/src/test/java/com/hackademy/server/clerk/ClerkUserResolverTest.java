package com.hackademy.server.clerk;

import com.hackademy.server.user.Role;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClerkUserResolverTest {

    @Mock com.hackademy.server.user.AccountDeletionRepository deletions;
    @Mock org.springframework.transaction.PlatformTransactionManager transactionManager;
    @Mock UserRepository userRepository;
    @Mock UsernameGenerator usernameGenerator;
    @InjectMocks ClerkUserResolver resolver;

    @Test
    void returnsTheLinkedAccount() {
        var user = user(1L, "user_1", "a@example.com");
        when(userRepository.findByClerkUserIdForUpdate("user_1")).thenReturn(Optional.of(user));

        assertSame(user, resolver.resolve(jwt("user_1", Map.of("email", "a@example.com", "email_verified", true))));
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    void keepsTheEmailWhenTheClaimIsMissingUnverifiedOrTaken() {
        var user = user(1L, "user_1", "a@example.com");
        when(userRepository.findByClerkUserIdForUpdate("user_1")).thenReturn(Optional.of(user));
        when(userRepository.findByEmail("b@example.com")).thenReturn(Optional.of(user(2L, null, "b@example.com")));

        resolver.resolve(jwt("user_1", Map.of()));
        resolver.resolve(jwt("user_1", Map.of("email", "c@example.com", "email_verified", false)));
        resolver.resolve(jwt("user_1", Map.of("email", "b@example.com", "email_verified", true)));

        assertEquals("a@example.com", user.getEmail());
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    void syncsAVerifiedEmailChangeFromClerk() {
        var user = user(1L, "user_1", "a@example.com");
        when(userRepository.findByClerkUserIdForUpdate("user_1")).thenReturn(Optional.of(user));
        when(userRepository.findByEmail("new@example.com")).thenReturn(Optional.empty());
        when(userRepository.updateClerkEmail(1L, "user_1", "new@example.com")).thenReturn(1);

        resolver.resolve(jwt("user_1", Map.of("email", "New@Example.com", "email_verified", "true")));

        assertEquals("new@example.com", user.getEmail());
    }

    @Test
    void keepsTheCurrentAccountWhenEmailSyncRaces() {
        var user = user(1L, "user_1", "a@example.com");
        when(userRepository.findByClerkUserIdForUpdate("user_1")).thenReturn(Optional.of(user));
        when(userRepository.findByEmail("new@example.com")).thenReturn(Optional.empty());
        when(userRepository.updateClerkEmail(1L, "user_1", "new@example.com")).thenThrow(new DataIntegrityViolationException("duplicate"));

        assertSame(user, resolver.resolve(jwt("user_1", Map.of("email", "new@example.com", "email_verified", true))));
    }

    @Test
    void rejectsEmailCollisionsInsteadOfClaimingLegacyAccounts() {
        var legacy = user(3L, null, "legacy@example.com");
        legacy.setRole(Role.ADMIN);
        when(userRepository.findByClerkUserIdForUpdate("user_attacker")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("legacy@example.com")).thenReturn(Optional.of(legacy));
        assertThrows(BadCredentialsException.class, () -> resolver.resolve(jwt("user_attacker",
                Map.of("external_id", "3", "email", "legacy@example.com", "email_verified", true))));
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    void createsANewPlayerWithAGeneratedName() {
        when(userRepository.findByClerkUserIdForUpdate("user_new")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("new@example.com")).thenReturn(Optional.empty());
        when(usernameGenerator.generate()).thenReturn("gracz123456");
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User created = resolver.resolve(jwt("user_new", Map.of("email", "new@example.com", "email_verified", true)));

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).saveAndFlush(saved.capture());
        assertSame(created, saved.getValue());
        assertEquals("gracz123456", created.getUsername());
        assertEquals(Role.USER, created.getRole());
        assertEquals("user_new", created.getClerkUserId());
    }

    @Test
    void rejectsNewAccountsWithoutAVerifiedEmail() {
        when(userRepository.findByClerkUserIdForUpdate("user_x")).thenReturn(Optional.empty());

        assertThrows(BadCredentialsException.class, () -> resolver.resolve(jwt("user_x", Map.of("email", "x@example.com"))));
        assertThrows(BadCredentialsException.class, () -> resolver.resolve(jwt("user_x", Map.of("email", " ", "email_verified", true))));
    }

    @Test
    void returnsTheWinnerOfAConcurrentFirstSignIn() {
        var winner = user(5L, "user_5", "five@example.com");
        when(userRepository.findByClerkUserIdForUpdate("user_5")).thenReturn(Optional.empty(), Optional.of(winner));
        when(userRepository.findByEmail("five@example.com")).thenReturn(Optional.empty());
        when(usernameGenerator.generate()).thenReturn("gracz555555");
        when(userRepository.saveAndFlush(any(User.class))).thenThrow(new DataIntegrityViolationException("duplicate"));

        assertSame(winner, resolver.resolve(jwt("user_5", Map.of("email", "five@example.com", "email_verified", true))));
    }

    @Test
    void reportsAConflictWhenNoAccountWonTheRace() {
        when(userRepository.findByClerkUserIdForUpdate("user_6")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("six@example.com")).thenReturn(Optional.empty());
        when(usernameGenerator.generate()).thenReturn("gracz666666");
        when(userRepository.saveAndFlush(any(User.class))).thenThrow(new DataIntegrityViolationException("duplicate"));

        var exception = assertThrows(BadCredentialsException.class,
                () -> resolver.resolve(jwt("user_6", Map.of("email", "six@example.com", "email_verified", true))));
        assertTrue(exception.getMessage().contains("conflicts"));
    }

    @Test
    void rejectsDeletedIdentitiesBeforeReturningOrCreatingAProfile() {
        when(deletions.existsByClerkUserId("user_deleted")).thenReturn(true);
        assertThrows(BadCredentialsException.class, () -> resolver.resolve(jwt("user_deleted", Map.of("email", "old@example.com", "email_verified", true))));
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    void rollsBackCreationWhenDeletionWonAConcurrentFirstSignIn() {
        when(deletions.existsByClerkUserId("user_new")).thenReturn(false, true);
        when(usernameGenerator.generate()).thenReturn("gracz123456");
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        assertThrows(BadCredentialsException.class, () -> resolver.resolve(jwt("user_new", Map.of("email", "new@example.com", "email_verified", true))));
        verify(transactionManager).rollback(any());
    }

    private static User user(Long id, String clerkUserId, String email) {
        return User.builder().id(id).username("user" + id).email(email).clerkUserId(clerkUserId).role(Role.USER).build();
    }

    private static Jwt jwt(String subject, Map<String, Object> claims) {
        Map<String, Object> all = new HashMap<>(claims);
        all.put("sub", subject);
        var builder = Jwt.withTokenValue("token").header("alg", "RS256").issuedAt(Instant.now());
        all.forEach(builder::claim);
        return builder.build();
    }
}
