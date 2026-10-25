package com.hackademy.server.realtime;

import com.hackademy.server.arena.ArenaService;
import com.hackademy.server.arena.MatchmakingService;
import com.hackademy.server.friendship.FriendDto;
import com.hackademy.server.room.Room;
import com.hackademy.server.room.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

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

    public List<FriendDto> describe(List<FriendDto> friends) {
        Map<Long, FriendDto> settled = new HashMap<>();
        Map<Long, Long> roomByFriend = new HashMap<>();
        for (FriendDto friend : friends) {
            var known = withoutRoom(friend);
            if (known != null) settled.put(friend.id(), known);
            else {
                Long roomId = presence.roomOf(friend.id());
                if (roomId != null) roomByFriend.put(friend.id(), roomId);
            }
        }
        Map<Long, String> titles = roomByFriend.isEmpty() ? Map.of() : rooms.findAllById(Set.copyOf(roomByFriend.values())).stream()
                .filter(Room::isPublished).collect(Collectors.toMap(Room::getId, Room::getTitle));
        return friends.stream().map(friend -> {
            var known = settled.get(friend.id());
            if (known != null) return known;
            Long roomId = roomByFriend.get(friend.id());
            String title = roomId == null ? null : titles.get(roomId);
            return title == null ? friend.withActivity(true, null, null, null) : friend.withActivity(true, ROOM, title, null);
        }).toList();
    }

    private FriendDto withoutRoom(FriendDto friend) {
        boolean online = presence.isOnline(friend.id());
        if (!friend.sharesActivity()) return friend.withActivity(online, null, null, null);
        if (!online) return friend.withActivity(false, null, null, latest(FriendDto.epochMillis(presence.lastSeen(friend.id())), friend.lastSeenAt()));
        if (arena.getObject().findActiveGameForUser(friend.id()) != null) return friend.withActivity(true, DUEL, null, null);
        if (matchmaking.getObject().isQueued(friend.id())) return friend.withActivity(true, ARENA_QUEUE, null, null);
        return null;
    }

    private static Long latest(Long memory, Long stored) {
        if (memory == null) return stored;
        return stored == null ? memory : Math.max(memory, stored);
    }
}
