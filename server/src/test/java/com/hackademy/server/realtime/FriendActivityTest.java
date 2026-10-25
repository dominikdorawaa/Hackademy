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
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
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

    private FriendDto one(FriendDto friend) {
        return activity.describe(List.of(friend)).get(0);
    }

    private static Room room(long id, String title, boolean published) {
        Room room = new Room();
        room.setId(id);
        room.setTitle(title);
        room.setPublished(published);
        return room;
    }

    @Test
    void reportsADuelBeforeTheQueueOrARoom() {
        when(presence.isOnline(2L)).thenReturn(true);
        when(arena.findActiveGameForUser(2L)).thenReturn(new GameSession());

        var friend = one(bob(true));

        assertTrue(friend.online());
        assertEquals(FriendActivity.DUEL, friend.activity());
        assertNull(friend.lastSeenAt());
        verifyNoInteractions(matchmaking, rooms);
    }

    @Test
    void leavesAnOnlineFriendOutsideAnyRoomPlainlyOnline() {
        when(presence.isOnline(2L)).thenReturn(true);
        when(presence.roomOf(2L)).thenReturn(null);

        var friend = one(bob(true));

        assertTrue(friend.online());
        assertNull(friend.activity());
        verifyNoInteractions(rooms);
    }

    @Test
    void reportsTheArenaQueue() {
        when(presence.isOnline(2L)).thenReturn(true);
        when(matchmaking.isQueued(2L)).thenReturn(true);

        assertEquals(FriendActivity.ARENA_QUEUE, one(bob(true)).activity());
    }

    @Test
    void namesOnlyPublishedRoomsWithOneLookupForTheWholeList() {
        var ola = new FriendDto(3L, "ola", 0, 0).withSharing(true, null);
        when(presence.isOnline(anyLong())).thenReturn(true);
        when(presence.roomOf(2L)).thenReturn(5L);
        when(presence.roomOf(3L)).thenReturn(6L);
        when(rooms.findAllById(Set.of(5L, 6L))).thenReturn(List.of(room(5L, "Ukryty skarb", true), room(6L, "Szkic", false)));

        var friends = activity.describe(List.of(bob(true), ola));

        assertEquals(FriendActivity.ROOM, friends.get(0).activity());
        assertEquals("Ukryty skarb", friends.get(0).activityRoom());
        assertTrue(friends.get(1).online());
        assertNull(friends.get(1).activity());
        assertNull(friends.get(1).activityRoom());
        verify(rooms, times(1)).findAllById(any());
    }

    @Test
    void offlineFriendsShowTheLatestKnownVisit() {
        assertEquals(FriendDto.epochMillis(STORED), one(bob(true)).lastSeenAt());

        when(presence.lastSeen(2L)).thenReturn(STORED.plusHours(1));
        var friend = one(bob(true));

        assertFalse(friend.online());
        assertNull(friend.activity());
        assertEquals(FriendDto.epochMillis(STORED.plusHours(1)), friend.lastSeenAt());
    }

    @Test
    void hiddenActivityKeepsOnlyTheOnlineDot() {
        when(presence.isOnline(2L)).thenReturn(true);

        var friend = one(bob(false));

        assertTrue(friend.online());
        assertNull(friend.activity());
        assertNull(friend.lastSeenAt());
        verifyNoInteractions(arena, matchmaking, rooms);
    }
}
