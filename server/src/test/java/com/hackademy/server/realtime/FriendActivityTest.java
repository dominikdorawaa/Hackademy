package com.hackademy.server.realtime;

import com.hackademy.server.arena.ArenaService;
import com.hackademy.server.arena.GameSession;
import com.hackademy.server.arena.MatchmakingService;
import com.hackademy.server.friendship.FriendDto;
import com.hackademy.server.room.Room;
import com.hackademy.server.room.RoomRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FriendActivityTest {
    private static final LocalDateTime STORED = LocalDateTime.of(2026, 10, 25, 10, 0);

    @Mock FriendPresence presence;
    @Mock ArenaService arena;
    @Mock MatchmakingService matchmaking;
    @Mock RoomRepository rooms;
    FriendActivity activity;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        ObjectProvider<ArenaService> arenas = mock(ObjectProvider.class);
        ObjectProvider<MatchmakingService> queues = mock(ObjectProvider.class);
        lenient().when(arenas.getObject()).thenReturn(arena);
        lenient().when(queues.getObject()).thenReturn(matchmaking);
        activity = new FriendActivity(presence, arenas, queues, rooms);
    }

    private static FriendDto bob(boolean shares) {
        return new FriendDto(2L, "bob", 0, 0).withSharing(shares, STORED);
    }

    private static Room room(String title, boolean published) {
        Room room = new Room();
        room.setTitle(title);
        room.setPublished(published);
        return room;
    }

    @Test
    void reportsADuelBeforeTheQueueOrARoom() {
        when(presence.isOnline(2L)).thenReturn(true);
        when(arena.findActiveGameForUser(2L)).thenReturn(new GameSession());

        var friend = activity.describe(bob(true));

        assertTrue(friend.online());
        assertEquals(FriendActivity.DUEL, friend.activity());
        assertNull(friend.lastSeenAt());
        verifyNoInteractions(matchmaking, rooms);
    }

    @Test
    void reportsTheArenaQueue() {
        when(presence.isOnline(2L)).thenReturn(true);
        when(matchmaking.isQueued(2L)).thenReturn(true);

        assertEquals(FriendActivity.ARENA_QUEUE, activity.describe(bob(true)).activity());
    }

    @Test
    void namesOnlyAPublishedRoom() {
        when(presence.isOnline(2L)).thenReturn(true);
        when(presence.roomOf(2L)).thenReturn(5L, 6L);
        when(rooms.findById(5L)).thenReturn(Optional.of(room("Ukryty skarb", true)));
        when(rooms.findById(6L)).thenReturn(Optional.of(room("Szkic", false)));

        var visible = activity.describe(bob(true));
        assertEquals(FriendActivity.ROOM, visible.activity());
        assertEquals("Ukryty skarb", visible.activityRoom());

        var hidden = activity.describe(bob(true));
        assertTrue(hidden.online());
        assertNull(hidden.activity());
        assertNull(hidden.activityRoom());
    }

    @Test
    void offlineFriendsShowTheLatestKnownVisit() {
        assertEquals(FriendDto.epochMillis(STORED), activity.describe(bob(true)).lastSeenAt());

        when(presence.lastSeen(2L)).thenReturn(STORED.plusHours(1));
        var friend = activity.describe(bob(true));

        assertFalse(friend.online());
        assertNull(friend.activity());
        assertEquals(FriendDto.epochMillis(STORED.plusHours(1)), friend.lastSeenAt());
    }

    @Test
    void hiddenActivityKeepsOnlyTheOnlineDot() {
        when(presence.isOnline(2L)).thenReturn(true);

        var friend = activity.describe(bob(false));

        assertTrue(friend.online());
        assertNull(friend.activity());
        assertNull(friend.lastSeenAt());
        verifyNoInteractions(arena, matchmaking, rooms);
    }
}
