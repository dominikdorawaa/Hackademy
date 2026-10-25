package com.hackademy.server.arena;

import com.hackademy.server.dashboard.DashboardSummaryCache;
import com.hackademy.server.friendship.FriendshipRepository;
import com.hackademy.server.realtime.RealtimeNotifier;
import com.hackademy.server.user.AvatarChangedEvent;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserAvatarRepository;
import com.hackademy.server.user.UserRepository;
import com.hackademy.server.user.UserService;
import com.hackademy.server.user.UserServiceImpl;
import com.hackademy.server.user.dto.UserAvatarDto;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.*;

class ArenaChallengeAvatarTest {
    private final UserRepository users = mock(UserRepository.class);
    private final UserAvatarRepository avatars = mock(UserAvatarRepository.class);
    private final RealtimeNotifier realtime = mock(RealtimeNotifier.class);
    private final MatchmakingServiceImpl matchmaking = new MatchmakingServiceImpl(users, realtime);
    private final ArenaServiceImpl arena = new ArenaServiceImpl(mock(ArenaQuestionRepository.class), mock(FriendshipRepository.class), users,
            avatars, mock(UserServiceImpl.class), mock(DashboardSummaryCache.class), realtime, mock(ArenaPresence.class), matchmaking);
    private final ArenaController controller = new ArenaController(matchmaking, arena, mock(UserService.class));
    private final AtomicLong now = new AtomicLong(1_000_000);
    private final Map<Long, UserAvatarDto> saved = new HashMap<>();
    private final UserAvatarDto first = avatar("dres", "kucyk");
    private final UserAvatarDto second = avatar("bluza", "irokez");

    private static UserAvatarDto avatar(String outfit, String hair) {
        return new UserAvatarDto(outfit, hair, "brak", "jasna", "rude", "bialy", "granatowy", "czerwony", "bialy", "przod", "beam", "groove");
    }

    @BeforeEach
    void playersExist() {
        for (long id = 1; id <= 4; id++) {
            User user = new User();
            user.setId(id);
            user.setUsername("player" + id);
            when(users.findById(id)).thenReturn(Optional.of(user));
        }
        when(avatars.findDtosByUserIds(anyCollection())).thenAnswer(call -> {
            Map<Long, UserAvatarDto> found = new HashMap<>();
            for (Object id : (Iterable<?>) call.getArgument(0)) if (saved.containsKey(id)) found.put((Long) id, saved.get(id));
            return found;
        });
        arena.useClock(now::get);
    }

    @AfterEach
    void signOut() {
        SecurityContextHolder.clearContext();
    }

    private Challenge challenge(long from, long to) {
        return arena.createChallenge(from, "player" + from, to, "player" + to);
    }

    private Set<Long> notified() {
        var calls = mockingDetails(realtime).getInvocations().stream()
                .filter(call -> call.getMethod().getName().equals("arenaChanged")).toList();
        assertEquals(1, calls.size());
        return Set.of((Long[]) calls.get(0).getRawArguments()[0]);
    }

    @Test
    void pendingChallengesShowTheAvatarsSavedAfterTheyWereSent() {
        saved.put(1L, first);
        var sent = challenge(1, 2);
        assertEquals(first, sent.getChallengerAvatar());
        assertNull(sent.getTargetAvatar());
        saved.put(1L, second);
        saved.put(2L, first);
        var received = arena.getPendingChallenges(2L).get(0);
        var outgoing = arena.getOutgoingChallenges(1L).get(0);
        for (var challenge : List.of(received, outgoing)) {
            assertEquals(sent.getId(), challenge.getId());
            assertEquals(second, challenge.getChallengerAvatar());
            assertEquals(first, challenge.getTargetAvatar());
            assertEquals("PENDING", challenge.getStatus());
            assertEquals(sent.getExpiresAt(), challenge.getExpiresAt());
        }
        assertEquals(first, sent.getChallengerAvatar());
    }

    @Test
    void theChallengeListFromTheControllerCarriesBothCurrentAvatars() {
        challenge(1, 2);
        saved.put(1L, first);
        saved.put(2L, second);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(users.findById(2L).orElseThrow(), null, List.of()));
        var listed = controller.getPendingChallenges().getBody().get(0);
        assertEquals(first, listed.getChallengerAvatar());
        assertEquals(second, listed.getTargetAvatar());
    }

    @Test
    void rejectionAndExpiryNoticesShowTheTargetsCurrentAvatar() {
        var rejected = challenge(1, 2);
        var expired = challenge(1, 3);
        arena.rejectChallenge(rejected.getId(), 2L);
        now.addAndGet(ArenaServiceImpl.DEFAULT_CHALLENGE_EXPIRY.toMillis());
        arena.expireChallenges();
        saved.put(2L, first);
        saved.put(3L, second);
        assertEquals(first, arena.getRejectedChallenges(1L).get(0).getTargetAvatar());
        assertEquals(second, arena.getExpiredChallenges(1L).get(0).getTargetAvatar());
        assertEquals(expired.getId(), arena.getExpiredChallenges(1L).get(0).getId());
    }

    @Test
    void playersWithoutASavedAvatarHaveNoConfigurationSoTheClientUsesItsFallback() {
        challenge(1, 2);
        var received = arena.getPendingChallenges(2L).get(0);
        assertNull(received.getChallengerAvatar());
        assertNull(received.getTargetAvatar());
    }

    @Test
    void emptyListsDoNotLookUpAvatars() {
        assertTrue(arena.getPendingChallenges(1L).isEmpty());
        assertTrue(arena.getOutgoingChallenges(1L).isEmpty());
        assertTrue(arena.getRejectedChallenges(1L).isEmpty());
        assertTrue(arena.getExpiredChallenges(1L).isEmpty());
        verify(avatars, never()).findDtosByUserIds(any());
    }

    @Test
    void anAvatarChangeRefreshesEveryoneWhoSeesTheChallengesOfThatPlayer() {
        challenge(1, 2);
        var rejected = challenge(3, 1);
        arena.rejectChallenge(rejected.getId(), 1L);
        challenge(4, 2);
        clearInvocations(realtime);
        arena.avatarChanged(new AvatarChangedEvent(1L));
        assertEquals(Set.of(1L, 2L, 3L), notified());
    }

    @Test
    void anAvatarChangeOfSomeoneWithoutChallengesSendsNothing() {
        challenge(1, 2);
        clearInvocations(realtime);
        arena.avatarChanged(new AvatarChangedEvent(4L));
        verifyNoInteractions(realtime);
    }
}
