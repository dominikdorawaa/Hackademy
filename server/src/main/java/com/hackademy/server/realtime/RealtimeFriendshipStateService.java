package com.hackademy.server.realtime;

import com.hackademy.server.friendship.FriendDto;
import com.hackademy.server.friendship.FriendRequestDto;
import com.hackademy.server.friendship.FriendshipRepository;
import com.hackademy.server.friendship.FriendshipStatus;
import com.hackademy.server.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RealtimeFriendshipStateService {
    private final UserRepository users;
    private final FriendshipRepository friendships;

    public record State(Long userId, List<FriendRequestDto> requests, List<FriendDto> friends) {}

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public State forUser(String username) {
        var user = users.findByUsername(username).orElseThrow();
        var requests = friendships.findPendingRequestsForUser(user).stream()
                .map(friendship -> new FriendRequestDto(friendship.getId(), friendship.getRequester().getUsername(),
                        friendship.getCreatedAt(), friendship.getRequester().getAvatarSeed())).toList();
        var friends = friendships.findByUserAndStatus(user, FriendshipStatus.ACCEPTED).stream()
                .map(friendship -> friendship.getRequester().getId().equals(user.getId())
                        ? friendship.getReceiver() : friendship.getRequester())
                .map(friend -> new FriendDto(friend.getId(), friend.getUsername(), friend.getPoints(),
                        friend.getStreak(), friend.getAvatarSeed())).toList();
        return new State(user.getId(), requests, friends);
    }
}
