package com.hackademy.server.clerk;

import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.random.RandomGenerator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class UsernameGeneratorTest {

    private final UserRepository repository = mock(UserRepository.class);

    @Test
    void generatesANeutralNameThatFitsTheUsernameRules() {
        when(repository.findByUsernameIgnoringCase(anyString())).thenReturn(Optional.empty());

        String username = new UsernameGenerator(repository).generate();

        assertTrue(username.matches("gracz[1-9][0-9]{5}"), username);
        assertTrue(username.length() >= 3 && username.length() <= 20);
    }

    @Test
    void skipsNamesThatAreAlreadyTaken() {
        RandomGenerator random = mock(RandomGenerator.class);
        when(random.nextInt(900000)).thenReturn(1, 2);
        when(repository.findByUsernameIgnoringCase("gracz100001")).thenReturn(Optional.of(new User()));
        when(repository.findByUsernameIgnoringCase("gracz100002")).thenReturn(Optional.empty());

        assertEquals("gracz100002", new UsernameGenerator(repository, random).generate());
    }

    @Test
    void failsAfterTooManyCollisions() {
        when(repository.findByUsernameIgnoringCase(anyString())).thenReturn(Optional.of(new User()));

        assertThrows(IllegalStateException.class, () -> new UsernameGenerator(repository).generate());
    }
}
