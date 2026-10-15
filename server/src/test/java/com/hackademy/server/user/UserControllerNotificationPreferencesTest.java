package com.hackademy.server.user;

import com.hackademy.server.user.dto.NotificationPreferencesDto;
import com.hackademy.server.user.dto.UpdateNotificationPreferenceRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserControllerNotificationPreferencesTest {

    private static final List<String> PREFERENCES =
            List.of("friendRequests", "challenges", "matchFound", "sound", "browserNotifications");

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

        assertEquals(NotificationPreferencesDto.defaults(), controller.getNotificationPreferences(authentication));
    }

    @Test
    void returnsStoredPreferences() {
        var stored = new NotificationPreferencesDto(false, true, false, true, true);
        when(repository.findById(1L)).thenReturn(Optional.of(new NotificationPreferences(1L, stored)));

        assertEquals(stored, controller.getNotificationPreferences(authentication));
    }

    @ParameterizedTest
    @ValueSource(strings = {"friendRequests", "challenges", "matchFound", "sound", "browserNotifications"})
    void updatesOnlyTheChosenPreference(String preference) {
        var stored = new NotificationPreferencesDto(true, true, true, true, false);
        when(repository.findById(1L)).thenReturn(Optional.of(new NotificationPreferences(1L, stored)));

        var result = controller.updateNotificationPreferences(authentication,
                new UpdateNotificationPreferenceRequest(preference, false));

        List<ArgumentCaptor<Boolean>> values = new ArrayList<>();
        for (int i = 0; i < 5; i++) values.add(ArgumentCaptor.forClass(Boolean.class));
        verify(repository).updatePreference(eq(1L), values.get(0).capture(), values.get(1).capture(),
                values.get(2).capture(), values.get(3).capture(), values.get(4).capture());
        Boolean[] expected = new Boolean[5];
        expected[PREFERENCES.indexOf(preference)] = false;
        assertEquals(Arrays.asList(expected), values.stream().map(ArgumentCaptor::getValue).toList());
        assertEquals(stored, result);
    }
}
