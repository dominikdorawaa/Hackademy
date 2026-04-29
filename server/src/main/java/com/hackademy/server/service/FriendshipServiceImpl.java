package com.hackademy.server.service;

import com.hackademy.server.dto.FriendDto;
import com.hackademy.server.dto.FriendRequestDto;
import com.hackademy.server.dto.UserSearchDto;
import com.hackademy.server.exception.UserNotFoundException;
import com.hackademy.server.model.Friendship;
import com.hackademy.server.model.FriendshipStatus;
import com.hackademy.server.model.User;
import com.hackademy.server.repository.FriendshipRepository;
import com.hackademy.server.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FriendshipServiceImpl implements FriendshipService {

    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;
    private final BadgeService badgeService; // Inject BadgeService

    private static final long CACHE_MS = 30_000; // 30 seconds
    private static final class CacheEntry<T> {
        final long timeMs;
        final T value;
        CacheEntry(long timeMs, T value) { this.timeMs = timeMs; this.value = value; }
    }
    private final ConcurrentHashMap<Long, CacheEntry<List<FriendDto>>> friendsCache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, CacheEntry<List<FriendRequestDto>>> requestsCache = new ConcurrentHashMap<>();

    private void invalidateCachesFor(Long userId) {
        if (userId == null) return;
        friendsCache.remove(userId);
        requestsCache.remove(userId);
    }

    @Override
    @Transactional
    public void sendFriendRequest(Long requesterId, String receiverUsername) {
        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new UserNotFoundException("Requester not found"));
        User receiver = userRepository.findByUsername(receiverUsername)
                .orElseThrow(() -> new UserNotFoundException("Receiver not found"));

        if (requester.getId().equals(receiver.getId())) {
            throw new IllegalArgumentException("Cannot send friend request to yourself");
        }

        Optional<Friendship> existing = friendshipRepository.findFriendshipBetween(requester, receiver);
        if (existing.isPresent()) {
            throw new IllegalArgumentException("Friendship or request already exists");
        }

        Friendship friendship = new Friendship(requester, receiver, FriendshipStatus.PENDING);
        friendshipRepository.save(friendship);
        invalidateCachesFor(requesterId);
        invalidateCachesFor(receiver.getId());
    }

    @Override
    @Transactional
    public void acceptFriendRequest(Long receiverId, Long requestId) {
        Friendship friendship = friendshipRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));

        if (!friendship.getReceiver().getId().equals(receiverId)) {
            throw new IllegalArgumentException("Not authorized to accept this request");
        }

        friendship.setStatus(FriendshipStatus.ACCEPTED);
        friendshipRepository.save(friendship);

        // Check badges for both users
        badgeService.checkAndAwardBadges(friendship.getReceiver());
        badgeService.checkAndAwardBadges(friendship.getRequester());

        invalidateCachesFor(friendship.getReceiver().getId());
        invalidateCachesFor(friendship.getRequester().getId());
    }

    @Override
    @Transactional
    public void rejectFriendRequest(Long receiverId, Long requestId) {
        Friendship friendship = friendshipRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));

        if (!friendship.getReceiver().getId().equals(receiverId)) {
            throw new IllegalArgumentException("Not authorized to reject this request");
        }

        friendshipRepository.delete(friendship);
        invalidateCachesFor(friendship.getReceiver().getId());
        invalidateCachesFor(friendship.getRequester().getId());
    }

    @Override
    @Transactional
    public void removeFriend(Long userId, Long friendId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));
        User friend = userRepository.findById(friendId)
                .orElseThrow(() -> new UserNotFoundException("Friend not found"));

        Friendship friendship = friendshipRepository.findFriendshipBetween(user, friend)
                .orElseThrow(() -> new IllegalArgumentException("Friendship not found"));

        friendshipRepository.delete(friendship);
        invalidateCachesFor(userId);
        invalidateCachesFor(friendId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<FriendDto> getFriends(Long userId) {
        long now = System.currentTimeMillis();
        CacheEntry<List<FriendDto>> cached = friendsCache.get(userId);
        if (cached != null && now - cached.timeMs <= CACHE_MS) {
            return cached.value;
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        List<Friendship> friendships = friendshipRepository.findByUserAndStatus(user, FriendshipStatus.ACCEPTED);

        List<FriendDto> out = friendships.stream()
                .map(f -> {
                    User friend = f.getRequester().getId().equals(userId) ? f.getReceiver() : f.getRequester();
                    return new FriendDto(friend.getId(), friend.getUsername(), friend.getPoints(), friend.getStreak());
                })
                .collect(Collectors.toList());

        friendsCache.put(userId, new CacheEntry<>(now, out));
        return out;
    }

    @Override
    @Transactional(readOnly = true)
    public List<FriendRequestDto> getPendingRequests(Long userId) {
        long now = System.currentTimeMillis();
        CacheEntry<List<FriendRequestDto>> cached = requestsCache.get(userId);
        if (cached != null && now - cached.timeMs <= CACHE_MS) {
            return cached.value;
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        List<FriendRequestDto> out = friendshipRepository.findPendingRequestsForUser(user).stream()
                .map(f -> new FriendRequestDto(f.getId(), f.getRequester().getUsername(), f.getCreatedAt()))
                .collect(Collectors.toList());

        requestsCache.put(userId, new CacheEntry<>(now, out));
        return out;
    }

    @Override
    @Transactional(readOnly = true)
    public String getFriendshipStatus(Long userId, String otherUsername) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));
        User otherUser = userRepository.findByUsername(otherUsername)
                .orElseThrow(() -> new UserNotFoundException("Other user not found"));

        Optional<Friendship> friendship = friendshipRepository.findFriendshipBetween(user, otherUser);

        if (friendship.isEmpty()) {
            return "NONE";
        }

        Friendship f = friendship.get();
        if (f.getStatus() == FriendshipStatus.ACCEPTED) {
            return "FRIENDS";
        } else {
            if (f.getRequester().getId().equals(userId)) {
                return "REQUEST_SENT";
            } else {
                return "REQUEST_RECEIVED";
            }
        }
    }

    @Override
    @Transactional(readOnly = true)
    public UserSearchDto getFriendshipStats(Long userId, String otherUsername) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));
        User otherUser = userRepository.findByUsername(otherUsername)
                .orElseThrow(() -> new UserNotFoundException("Other user not found"));

        Optional<Friendship> friendship = friendshipRepository.findFriendshipBetween(user, otherUser);

        String status = "NONE";
        int wins = 0;
        int losses = 0;

        if (friendship.isPresent()) {
            Friendship f = friendship.get();
            if (f.getStatus() == FriendshipStatus.ACCEPTED) {
                status = "FRIENDS";
                if (f.getRequester().getId().equals(userId)) {
                    wins = f.getRequesterWins();
                    losses = f.getReceiverWins();
                } else {
                    wins = f.getReceiverWins();
                    losses = f.getRequesterWins();
                }
            } else {
                if (f.getRequester().getId().equals(userId)) {
                    status = "REQUEST_SENT";
                } else {
                    status = "REQUEST_RECEIVED";
                }
            }
        }

        return UserSearchDto.builder()
                .id(otherUser.getId())
                .username(otherUser.getUsername())
                .points(otherUser.getPoints())
                .friendshipStatus(status)
                .winsAgainst(wins)
                .lossesAgainst(losses)
                .build();
    }
}
