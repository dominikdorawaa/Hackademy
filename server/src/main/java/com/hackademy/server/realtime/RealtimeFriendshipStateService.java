package com.hackademy.server.realtime;

import com.hackademy.server.friendship.FriendDto;
import com.hackademy.server.friendship.FriendRequestDto;
import com.hackademy.server.friendship.FriendshipRepository;
import com.hackademy.server.friendship.FriendshipStatus;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserAvatarRepository;
import com.hackademy.server.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class RealtimeFriendshipStateService {
    private final UserRepository users;
    private final FriendshipRepository friendships;
    private final UserAvatarRepository avatars;
    private final FriendActivity activity;

    public record State(Long userId, List<FriendRequestDto> requests, List<FriendDto> friends) {}

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public State forUser(Long userId) {
        var user = users.findById(userId).orElseThrow();
        var pending = friendships.findPendingRequestsForUser(user);
        var accepted = friendships.findByUserAndStatus(user, FriendshipStatus.ACCEPTED);
        var avatarsById = avatars.findDtosByUserIds(Stream.concat(
                pending.stream().map(friendship -> friendship.getRequester().getId()),
                accepted.stream().map(f -> f.getRequester().getId().equals(userId) ? f.getReceiver().getId() : f.getRequester().getId())).distinct().toList());
        var requests = pending.stream()
                .map(friendship -> new FriendRequestDto(friendship.getId(), friendship.getRequester().getUsername(),
                        friendship.getCreatedAt(),
                        avatarsById.get(friendship.getRequester().getId()))).toList();
        var friends = accepted.stream().map(f -> {
            boolean requester = f.getRequester().getId().equals(userId);
            var friend = requester ? f.getReceiver() : f.getRequester();
            return activity.describe(new FriendDto(friend.getId(), friend.getUsername(), friend.getPoints(), friend.getStreak(),
                    avatarsById.get(friend.getId()), false,
                    requester ? f.getRequesterWins() : f.getReceiverWins(),
                    requester ? f.getReceiverWins() : f.getRequesterWins())
                    .withSharing(friend.isShareActivity(), friend.getLastSeenAt()));
        }).toList();
        return new State(user.getId(), requests, friends);
    }
}
