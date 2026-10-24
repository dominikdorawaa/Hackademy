package com.hackademy.server.arena;

import com.hackademy.server.user.dto.UserAvatarDto;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.SplittableRandom;

import static org.junit.jupiter.api.Assertions.*;

class BotIdentityTest {

    @Test
    void namesLookLikePlayerNamesAndNeverMentionBots() {
        var random = new SplittableRandom(3);
        Set<String> names = new HashSet<>();
        for (int draw = 0; draw < 5_000; draw++) {
            String name = BotIdentity.username(random, candidate -> false);
            assertTrue(name.length() >= 3 && name.length() <= 20, name);
            assertTrue(name.matches("[A-Za-z0-9_]+"), name);
            assertFalse(name.toLowerCase(Locale.ROOT).contains("bot"), name);
            names.add(name);
        }
        assertTrue(names.size() > 1_000);
        assertTrue(names.stream().anyMatch(name -> name.startsWith(BotIdentity.DEFAULT_PREFIX)));
        assertTrue(names.stream().anyMatch(name -> name.contains("_")));
        assertTrue(names.stream().anyMatch(name -> name.matches("[A-Z][a-z]+[A-Z][a-z]+[0-9]{2}")));
    }

    @Test
    void namesOfRealPlayersAreSkipped() {
        var random = new SplittableRandom(5);
        List<String> asked = new ArrayList<>();
        String name = BotIdentity.username(random, candidate -> asked.add(candidate) && asked.size() < 4);
        assertEquals(4, asked.size());
        assertEquals(asked.get(3), name);
    }

    @Test
    void anOccupiedNameSpaceFailsInsteadOfCopyingAPlayer() {
        assertThrows(IllegalStateException.class, () -> BotIdentity.username(new SplittableRandom(1), candidate -> true));
    }

    @Test
    void avatarsAreValidAndVaried() {
        var random = new SplittableRandom(9);
        var validator = Validation.buildDefaultValidatorFactory().getValidator();
        Set<UserAvatarDto> avatars = new HashSet<>();
        for (int draw = 0; draw < 500; draw++) {
            UserAvatarDto avatar = BotIdentity.avatar(random);
            assertTrue(validator.validate(avatar).isEmpty(), avatar.toString());
            assertFalse(avatar.skin().startsWith("#"));
            avatars.add(avatar);
        }
        assertTrue(avatars.size() > 400);
    }
}
