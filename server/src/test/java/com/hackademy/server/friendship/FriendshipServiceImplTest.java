package com.hackademy.server.friendship;

import com.hackademy.server.badge.BadgeService;
import com.hackademy.server.dashboard.DashboardSummaryCache;
import com.hackademy.server.dashboard.DashboardSummaryDto;
import com.hackademy.server.exception.UserNotFoundException;
import com.hackademy.server.realtime.RealtimeNotifier;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import com.hackademy.server.user.UserAvatarRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FriendshipServiceImplTest {

    @Mock FriendshipRepository friendshipRepository;
    @Mock UserRepository userRepository;
    @Mock BadgeService badgeService;
    @Mock RealtimeNotifier realtime;
    @Mock UserAvatarRepository userAvatarRepository;
    final DashboardSummaryCache dashboards = new DashboardSummaryCache();
    FriendshipServiceImpl service;

    User alice;
    User bob;

    @BeforeEach
    void setUp() {
        service = new FriendshipServiceImpl(friendshipRepository, userRepository, badgeService, dashboards, realtime, userAvatarRepository);
        alice = user(1L, "alice");
        bob = user(2L, "bob");
        dashboards.put(1L, DashboardSummaryDto.builder().build(), dashboards.generation());
        dashboards.put(2L, DashboardSummaryDto.builder().build(), dashboards.generation());
    }

    private void assertDashboardsRefreshedFor(Long... userIds) {
        for (Long userId : userIds) {
            assertNull(dashboards.getIfFresh(userId), "dashboard of user " + userId + " is stale");
        }
    }

    @Test
    void sendsPendingRequestAndNotifiesBothUsers() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(alice));
        when(userRepository.findByUsername("bob")).thenReturn(Optional.of(bob));
        when(friendshipRepository.findFriendshipBetween(alice, bob)).thenReturn(Optional.empty());

        service.sendFriendRequest(1L, "bob");

        var saved = ArgumentCaptor.forClass(Friendship.class);
        verify(friendshipRepository).save(saved.capture());
        assertSame(alice, saved.getValue().getRequester());
        assertSame(bob, saved.getValue().getReceiver());
        assertEquals(FriendshipStatus.PENDING, saved.getValue().getStatus());
        assertDashboardsRefreshedFor(1L, 2L);
        verify(realtime).changed(1L, 2L);
    }

    @Test
    void rejectsRequestToYourself() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(alice));
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(alice));

        assertThrows(IllegalArgumentException.class, () -> service.sendFriendRequest(1L, "alice"));
        verify(friendshipRepository, never()).save(any());
    }

    @Test
    void rejectsDuplicateRequest() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(alice));
        when(userRepository.findByUsername("bob")).thenReturn(Optional.of(bob));
        when(friendshipRepository.findFriendshipBetween(alice, bob))
                .thenReturn(Optional.of(friendship(bob, alice, FriendshipStatus.PENDING)));

        assertThrows(IllegalArgumentException.class, () -> service.sendFriendRequest(1L, "bob"));
        verify(friendshipRepository, never()).save(any());
    }

    @Test
    void sendingRequiresBothUsers() {
        when(userRepository.findById(1L)).thenReturn(Optional.empty());
        assertThrows(UserNotFoundException.class, () -> service.sendFriendRequest(1L, "bob"));

        when(userRepository.findById(1L)).thenReturn(Optional.of(alice));
        when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());
        assertThrows(UserNotFoundException.class, () -> service.sendFriendRequest(1L, "ghost"));
    }

    @Test
    void receiverAcceptsAndBothSidesAreCheckedForBadges() {
        var request = friendship(alice, bob, FriendshipStatus.PENDING);
        when(friendshipRepository.findById(10L)).thenReturn(Optional.of(request));

        service.acceptFriendRequest(2L, 10L);

        assertEquals(FriendshipStatus.ACCEPTED, request.getStatus());
        verify(friendshipRepository).save(request);
        verify(badgeService).checkAndAwardBadges(bob);
        verify(badgeService).checkAndAwardBadges(alice);
        assertDashboardsRefreshedFor(1L, 2L);
        verify(realtime).changed(1L, 2L);
    }

    @Test
    void onlyReceiverCanAccept() {
        var request = friendship(alice, bob, FriendshipStatus.PENDING);
        when(friendshipRepository.findById(10L)).thenReturn(Optional.of(request));

        assertThrows(IllegalArgumentException.class, () -> service.acceptFriendRequest(1L, 10L));
        assertThrows(IllegalArgumentException.class, () -> service.acceptFriendRequest(3L, 10L));
        assertEquals(FriendshipStatus.PENDING, request.getStatus());
        verifyNoInteractions(badgeService);
        verify(friendshipRepository, never()).save(any());
    }

    @Test
    void acceptingMissingRequestFails() {
        when(friendshipRepository.findById(10L)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class, () -> service.acceptFriendRequest(2L, 10L));
    }

    @Test
    void receiverRejectsByDeletingRequest() {
        var request = friendship(alice, bob, FriendshipStatus.PENDING);
        when(friendshipRepository.findById(10L)).thenReturn(Optional.of(request));

        service.rejectFriendRequest(2L, 10L);

        verify(friendshipRepository).delete(request);
        assertDashboardsRefreshedFor(1L, 2L);
        verify(realtime).changed(1L, 2L);
    }

    @Test
    void onlyReceiverCanReject() {
        var request = friendship(alice, bob, FriendshipStatus.PENDING);
        when(friendshipRepository.findById(10L)).thenReturn(Optional.of(request));

        assertThrows(IllegalArgumentException.class, () -> service.rejectFriendRequest(1L, 10L));
        verify(friendshipRepository, never()).delete(any());

        when(friendshipRepository.findById(11L)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class, () -> service.rejectFriendRequest(2L, 11L));
    }

    @Test
    void acceptedFriendshipCanStillBeRejectedAndReaccepted() {
        // Pins current behaviour (see #104): accept and reject do not require a PENDING request.
        var accepted = friendship(alice, bob, FriendshipStatus.ACCEPTED);
        when(friendshipRepository.findById(10L)).thenReturn(Optional.of(accepted));

        service.acceptFriendRequest(2L, 10L);
        verify(badgeService).checkAndAwardBadges(alice);

        service.rejectFriendRequest(2L, 10L);
        verify(friendshipRepository).delete(accepted);
    }

    @Test
    void removesExistingFriendship() {
        var friendship = friendship(alice, bob, FriendshipStatus.ACCEPTED);
        when(userRepository.findById(1L)).thenReturn(Optional.of(alice));
        when(userRepository.findById(2L)).thenReturn(Optional.of(bob));
        when(friendshipRepository.findFriendshipBetween(alice, bob)).thenReturn(Optional.of(friendship));

        service.removeFriend(1L, 2L);

        verify(friendshipRepository).delete(friendship);
        assertDashboardsRefreshedFor(1L, 2L);
        verify(realtime).changed(1L, 2L);
    }

    @Test
    void removingRequiresUsersAndFriendship() {
        when(userRepository.findById(1L)).thenReturn(Optional.empty());
        assertThrows(UserNotFoundException.class, () -> service.removeFriend(1L, 2L));

        when(userRepository.findById(1L)).thenReturn(Optional.of(alice));
        when(userRepository.findById(2L)).thenReturn(Optional.empty());
        assertThrows(UserNotFoundException.class, () -> service.removeFriend(1L, 2L));

        when(userRepository.findById(2L)).thenReturn(Optional.of(bob));
        when(friendshipRepository.findFriendshipBetween(alice, bob)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class, () -> service.removeFriend(1L, 2L));
        verify(friendshipRepository, never()).delete(any());
    }

    @Test
    void listsTheOtherSideOfEachFriendshipAndCachesIt() {
        var carol = user(3L, "carol");
        when(userRepository.findById(1L)).thenReturn(Optional.of(alice));
        when(friendshipRepository.findByUserAndStatus(alice, FriendshipStatus.ACCEPTED)).thenReturn(List.of(
                friendship(alice, bob, FriendshipStatus.ACCEPTED),
                friendship(carol, alice, FriendshipStatus.ACCEPTED)));

        var friends = service.getFriends(1L);

        assertEquals(List.of(
                new FriendDto(2L, "bob", 20, 2, "bob-seed"),
                new FriendDto(3L, "carol", 30, 3, "carol-seed")), friends);
        assertSame(friends, service.getFriends(1L));
        verify(friendshipRepository, times(1)).findByUserAndStatus(alice, FriendshipStatus.ACCEPTED);

        service.invalidateProfileCaches();
        service.getFriends(1L);
        verify(friendshipRepository, times(2)).findByUserAndStatus(alice, FriendshipStatus.ACCEPTED);
        assertDashboardsRefreshedFor(1L, 2L);
    }

    @Test
    void friendListRequiresUser() {
        when(userRepository.findById(1L)).thenReturn(Optional.empty());
        assertThrows(UserNotFoundException.class, () -> service.getFriends(1L));
        assertThrows(UserNotFoundException.class, () -> service.getPendingRequests(1L));
    }

    @Test
    void listsPendingRequestsAndRefreshesAfterChange() {
        var request = friendship(bob, alice, FriendshipStatus.PENDING);
        request.setId(10L);
        request.setCreatedAt(LocalDateTime.of(2026, 1, 2, 3, 4));
        when(userRepository.findById(1L)).thenReturn(Optional.of(alice));
        when(friendshipRepository.findPendingRequestsForUser(alice)).thenReturn(List.of(request));

        var requests = service.getPendingRequests(1L);

        assertEquals(List.of(new FriendRequestDto(10L, "bob", request.getCreatedAt(), "bob-seed")), requests);
        assertSame(requests, service.getPendingRequests(1L));
        verify(friendshipRepository, times(1)).findPendingRequestsForUser(alice);

        when(friendshipRepository.findById(10L)).thenReturn(Optional.of(request));
        service.rejectFriendRequest(1L, 10L);
        service.getPendingRequests(1L);
        verify(friendshipRepository, times(2)).findPendingRequestsForUser(alice);
    }

    @Test
    void reportsFriendshipStatusFromEachSide() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(alice));
        when(userRepository.findByUsername("bob")).thenReturn(Optional.of(bob));

        when(friendshipRepository.findFriendshipBetween(alice, bob)).thenReturn(Optional.empty());
        assertEquals("NONE", service.getFriendshipStatus(1L, "bob"));

        when(friendshipRepository.findFriendshipBetween(alice, bob))
                .thenReturn(Optional.of(friendship(alice, bob, FriendshipStatus.ACCEPTED)));
        assertEquals("FRIENDS", service.getFriendshipStatus(1L, "bob"));

        when(friendshipRepository.findFriendshipBetween(alice, bob))
                .thenReturn(Optional.of(friendship(alice, bob, FriendshipStatus.PENDING)));
        assertEquals("REQUEST_SENT", service.getFriendshipStatus(1L, "bob"));

        when(friendshipRepository.findFriendshipBetween(alice, bob))
                .thenReturn(Optional.of(friendship(bob, alice, FriendshipStatus.PENDING)));
        assertEquals("REQUEST_RECEIVED", service.getFriendshipStatus(1L, "bob"));
    }

    @Test
    void statusRequiresBothUsers() {
        when(userRepository.findById(1L)).thenReturn(Optional.empty());
        assertThrows(UserNotFoundException.class, () -> service.getFriendshipStatus(1L, "bob"));
        assertThrows(UserNotFoundException.class, () -> service.getFriendshipStats(1L, "bob"));

        when(userRepository.findById(1L)).thenReturn(Optional.of(alice));
        when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());
        assertThrows(UserNotFoundException.class, () -> service.getFriendshipStatus(1L, "ghost"));
        assertThrows(UserNotFoundException.class, () -> service.getFriendshipStats(1L, "ghost"));
    }

    @Test
    void statsSwapWinsAndLossesBySide() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(alice));
        when(userRepository.findById(2L)).thenReturn(Optional.of(bob));
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(alice));
        when(userRepository.findByUsername("bob")).thenReturn(Optional.of(bob));
        var friendship = friendship(alice, bob, FriendshipStatus.ACCEPTED);
        friendship.setRequesterWins(5);
        friendship.setReceiverWins(3);
        when(friendshipRepository.findFriendshipBetween(any(), any())).thenReturn(Optional.of(friendship));

        var asRequester = service.getFriendshipStats(1L, "bob");
        assertEquals(2L, asRequester.id());
        assertEquals("bob", asRequester.username());
        assertEquals("bob-seed", asRequester.avatarSeed());
        assertEquals(20, asRequester.points());
        assertEquals("FRIENDS", asRequester.friendshipStatus());
        assertEquals(5, asRequester.winsAgainst());
        assertEquals(3, asRequester.lossesAgainst());

        var asReceiver = service.getFriendshipStats(2L, "alice");
        assertEquals(3, asReceiver.winsAgainst());
        assertEquals(5, asReceiver.lossesAgainst());
    }

    @Test
    void statsForPendingOrMissingFriendshipHaveNoScore() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(alice));
        when(userRepository.findByUsername("bob")).thenReturn(Optional.of(bob));

        when(friendshipRepository.findFriendshipBetween(alice, bob)).thenReturn(Optional.empty());
        var none = service.getFriendshipStats(1L, "bob");
        assertEquals("NONE", none.friendshipStatus());
        assertEquals(0, none.winsAgainst());
        assertEquals(0, none.lossesAgainst());

        when(friendshipRepository.findFriendshipBetween(alice, bob))
                .thenReturn(Optional.of(friendship(alice, bob, FriendshipStatus.PENDING)));
        assertEquals("REQUEST_SENT", service.getFriendshipStats(1L, "bob").friendshipStatus());

        when(friendshipRepository.findFriendshipBetween(alice, bob))
                .thenReturn(Optional.of(friendship(bob, alice, FriendshipStatus.PENDING)));
        assertEquals("REQUEST_RECEIVED", service.getFriendshipStats(1L, "bob").friendshipStatus());
    }

    private static User user(long id, String username) {
        return User.builder()
                .id(id)
                .username(username)
                .avatarSeed(username + "-seed")
                .points((int) id * 10)
                .streak((int) id)
                .build();
    }

    private static Friendship friendship(User requester, User receiver, FriendshipStatus status) {
        return new Friendship(requester, receiver, status);
    }
}
