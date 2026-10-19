package com.hackademy.server.clerk;

import com.hackademy.server.user.Role;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ClerkUserImporterTest {

    private final UserRepository repository = mock(UserRepository.class);
    private final ClerkBackendClient client = mock(ClerkBackendClient.class);
    private final ClerkUserImporter importer = new ClerkUserImporter(repository, client);

    @Test
    void createsClerkUsersWithTheExistingPasswordHash() {
        var user = user(1L, "a@example.com", "$2a$10$hash");
        when(repository.findByClerkUserIdIsNullOrderByIdAsc()).thenReturn(List.of(user));
        when(client.findByExternalId("1")).thenReturn(List.of());
        when(client.create("1", "a@example.com", "$2a$10$hash")).thenReturn(new ClerkBackendClient.ClerkUser("user_a", "1"));

        assertEquals(new ClerkUserImporter.ImportResult(1, 0, 0), importer.importAll());
        assertEquals("user_a", user.getClerkUserId());
        verify(repository).saveAndFlush(user);
    }

    @Test
    void reusesAClerkUserCreatedByAnEarlierRun() {
        var user = user(2L, "b@example.com", "$2a$10$hash");
        when(repository.findByClerkUserIdIsNullOrderByIdAsc()).thenReturn(List.of(user));
        when(client.findByExternalId("2")).thenReturn(List.of(new ClerkBackendClient.ClerkUser("user_b", "2")));

        assertEquals(new ClerkUserImporter.ImportResult(0, 1, 0), importer.importAll());
        assertEquals("user_b", user.getClerkUserId());
        verify(client, never()).create(anyString(), anyString(), any());
    }

    @Test
    void leavesExistingClerkAccountsUnchangedOnEmailConflict() {
        var user = user(3L, "c@example.com", "$2a$10$hash");
        when(repository.findByClerkUserIdIsNullOrderByIdAsc()).thenReturn(List.of(user));
        when(client.findByExternalId("3")).thenReturn(List.of());
        when(client.create("3", "c@example.com", "$2a$10$hash")).thenThrow(unprocessable());
        assertEquals(new ClerkUserImporter.ImportResult(0, 0, 1), importer.importAll());
        assertNull(user.getClerkUserId());
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void countsFailuresAndContinuesWithTheNextAccount() {
        var owned = user(4L, "d@example.com", "$2a$10$hash");
        var empty = user(5L, "e@example.com", "$2a$10$hash");
        var next = user(6L, "f@example.com", "$2a$10$hash");
        when(repository.findByClerkUserIdIsNullOrderByIdAsc()).thenReturn(List.of(owned, empty, next));
        when(client.findByExternalId(anyString())).thenReturn(List.of());
        when(client.create("4", "d@example.com", "$2a$10$hash")).thenThrow(unprocessable());
        when(client.create("5", "e@example.com", "$2a$10$hash")).thenReturn(new ClerkBackendClient.ClerkUser(" ", "5"));
        when(client.create("6", "f@example.com", "$2a$10$hash")).thenReturn(new ClerkBackendClient.ClerkUser("user_f", "6"));

        var forbidden = user(7L, "g@example.com", "$2a$10$hash");
        when(client.create("7", "g@example.com", "$2a$10$hash"))
                .thenThrow(HttpClientErrorException.create(HttpStatus.FORBIDDEN, "no", null, null, null));
        when(repository.findByClerkUserIdIsNullOrderByIdAsc()).thenReturn(List.of(owned, empty, next, forbidden));

        assertEquals(new ClerkUserImporter.ImportResult(1, 0, 3), importer.importAll());
        assertNull(owned.getClerkUserId());
        assertNull(empty.getClerkUserId());
        assertEquals("user_f", next.getClerkUserId());
    }

    private static HttpClientErrorException unprocessable() {
        return HttpClientErrorException.create(HttpStatus.UNPROCESSABLE_CONTENT, "taken", null, null, null);
    }

    private static User user(Long id, String email, String password) {
        return User.builder().id(id).username("user" + id).email(email).password(password).role(Role.USER).build();
    }
}
