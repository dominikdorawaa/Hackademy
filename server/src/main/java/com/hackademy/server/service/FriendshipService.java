package com.hackademy.server.service;

import com.hackademy.server.dto.FriendDto;
import com.hackademy.server.dto.FriendRequestDto;
import com.hackademy.server.dto.UserSearchDto;

import java.util.List;

public interface FriendshipService {
    void sendFriendRequest(Long requesterId, String receiverUsername);
    void acceptFriendRequest(Long receiverId, Long requestId);
    void rejectFriendRequest(Long receiverId, Long requestId);
    void removeFriend(Long userId, Long friendId);
    List<FriendDto> getFriends(Long userId);
    List<FriendRequestDto> getPendingRequests(Long userId);
    String getFriendshipStatus(Long userId, String otherUsername);
    UserSearchDto getFriendshipStats(Long userId, String otherUsername);
}
