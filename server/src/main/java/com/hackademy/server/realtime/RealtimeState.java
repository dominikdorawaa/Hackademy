package com.hackademy.server.realtime;

import com.hackademy.server.arena.Challenge;
import com.hackademy.server.arena.GameSession;
import com.hackademy.server.friendship.FriendDto;
import com.hackademy.server.friendship.FriendRequestDto;

import java.util.List;

public record RealtimeState(String streamId, long revision, List<FriendRequestDto> friendRequests,
        List<FriendDto> friends, List<Challenge> challenges, List<Challenge> outgoingChallenges,
        GameSession gameSession, boolean queued) {}
