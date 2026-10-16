package com.hackademy.server.user;

import com.hackademy.server.user.dto.NotificationPreferencesDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

// Saving a single preference is covered end to end by NotificationPreferencesIntegrationTest.
@ExtendWith(MockitoExtension.class)
class UserControllerNotificationPreferencesTest {

    @Mock UserService userService;
    @Mock NotificationPreferencesRepository repository;
    @Mock Authentication authentication;
    @InjectMocks UserController controller;

    @BeforeEach
    void signIn() {
        when(authentication.getPrincipal()).thenReturn(User.builder().id(1L).username("alice").build());
    }

    @Test
    void returnsDefaultsWhenNothingIsStored() {
        when(repository.findById(1L)).thenReturn(Optional.empty());

        assertEquals(new NotificationPreferencesDto(true, true, true, false, false),
                controller.getNotificationPreferences(authentication));
    }

    @Test
    void returnsStoredPreferences() {
        var stored = new NotificationPreferencesDto(false, true, false, true, true);
        when(repository.findById(1L)).thenReturn(Optional.of(new NotificationPreferences(1L, stored)));

        assertEquals(stored, controller.getNotificationPreferences(authentication));
    }
}
