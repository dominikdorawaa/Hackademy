package com.hackademy.server.realtime;

import com.hackademy.server.arena.ArenaService;
import com.hackademy.server.arena.MatchmakingService;
import com.hackademy.server.friendship.FriendDto;
import com.hackademy.server.room.Room;
import com.hackademy.server.room.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class FriendActivity {
    public static final String DUEL = "DUEL";
    public static final String ARENA_QUEUE = "ARENA_QUEUE";
    public static final String ROOM = "ROOM";

    private final FriendPresence presence;
    private final ObjectProvider<ArenaService> arena;
    private final ObjectProvider<MatchmakingService> matchmaking;
    private final RoomRepository rooms;

    public FriendDto describe(FriendDto friend) {
        boolean online = presence.isOnline(friend.id());
        if (!friend.sharesActivity()) return friend.withActivity(online, null, null, null);
        if (!online) return friend.withActivity(false, null, null, latest(FriendDto.epochMillis(presence.lastSeen(friend.id())), friend.lastSeenAt()));
        if (arena.getObject().findActiveGameForUser(friend.id()) != null) return friend.withActivity(true, DUEL, null, null);
        if (matchmaking.getObject().isQueued(friend.id())) return friend.withActivity(true, ARENA_QUEUE, null, null);
        Long roomId = presence.roomOf(friend.id());
        String title = roomId == null ? null : rooms.findById(roomId).filter(Room::isPublished).map(Room::getTitle).orElse(null);
        return title == null ? friend.withActivity(true, null, null, null) : friend.withActivity(true, ROOM, title, null);
    }

    private static Long latest(Long memory, Long stored) {
        if (memory == null) return stored;
        return stored == null ? memory : Math.max(memory, stored);
    }
}
