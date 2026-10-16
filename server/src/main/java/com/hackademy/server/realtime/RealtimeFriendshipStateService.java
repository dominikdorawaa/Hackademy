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

    public record State(Long userId, List<FriendRequestDto> requests, List<FriendDto> friends) {}

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public State forUser(Long userId) {
        var user = users.findById(userId).orElseThrow();
        var pending = friendships.findPendingRequestsForUser(user);
        List<User> accepted = friendships.findByUserAndStatus(user, FriendshipStatus.ACCEPTED).stream()
                .map(friendship -> friendship.getRequester().getId().equals(user.getId())
                        ? friendship.getReceiver() : friendship.getRequester())
                .toList();
        var avatarsById = avatars.findDtosByUserIds(Stream.concat(
                pending.stream().map(friendship -> friendship.getRequester().getId()),
                accepted.stream().map(User::getId)).distinct().toList());
        var requests = pending.stream()
                .map(friendship -> new FriendRequestDto(friendship.getId(), friendship.getRequester().getUsername(),
                        friendship.getCreatedAt(), friendship.getRequester().getAvatarSeed(),
                        avatarsById.get(friendship.getRequester().getId()))).toList();
        var friends = accepted.stream()
                .map(friend -> new FriendDto(friend.getId(), friend.getUsername(), friend.getPoints(),
                        friend.getStreak(), friend.getAvatarSeed(), avatarsById.get(friend.getId()))).toList();
        return new State(user.getId(), requests, friends);
    }
}
