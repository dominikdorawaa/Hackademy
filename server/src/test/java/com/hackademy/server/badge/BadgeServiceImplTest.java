package com.hackademy.server.badge;

import com.hackademy.server.dashboard.DashboardSummaryCache;
import com.hackademy.server.exception.UserNotFoundException;
import com.hackademy.server.friendship.Friendship;
import com.hackademy.server.friendship.FriendshipRepository;
import com.hackademy.server.friendship.FriendshipStatus;
import com.hackademy.server.room.UserSolvedRoomRepository;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BadgeServiceImplTest {
    @Test
    void awardingDuringAProfileReadCannotClearItsCatalogSnapshot() {
        User learner = user(500);
        when(badgeRepository.findAll()).thenReturn(List.of(badge(1L, "POINTS", 100)));
        when(userRepository.findById(7L)).thenReturn(java.util.Optional.of(learner));
        var firstRead = new java.util.concurrent.atomic.AtomicBoolean(true);
        when(userBadgeRepository.findEarnedBadgeRowsByUserId(7L)).thenAnswer(invocation -> {
            if (firstRead.getAndSet(false)) service.checkAndAwardBadges(learner);
            return List.of();
        });
        assertEquals(1, service.getAllBadgesWithStatus(7L).size());
    }

    static final Clock TODAY = Clock.fixed(Instant.parse("2026-10-15T12:00:00Z"), ZoneOffset.UTC);

    @Mock BadgeRepository badgeRepository;
    @Mock UserBadgeRepository userBadgeRepository;
    @Mock UserSolvedRoomRepository userSolvedRoomRepository;
    @Mock FriendshipRepository friendshipRepository;
    @Mock UserRepository userRepository;
    @Mock DashboardSummaryCache dashboardSummaryCache;
    BadgeServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new BadgeServiceImpl(badgeRepository, userBadgeRepository, userSolvedRoomRepository,
                friendshipRepository, userRepository, dashboardSummaryCache, TODAY);
    }

    // ── awarding ────────────────────────────────────────────────────────────

    @Test
    void userReachingPointsThresholdEarnsBadge() {
        Badge badge = badge(1L, "POINTS", 100);
        when(badgeRepository.findAll()).thenReturn(List.of(badge));
        when(userRepository.count()).thenReturn(1L);

        var earned = service.checkAndAwardBadges(user(100));

        assertEquals(List.of("POINTS 100"), earned.stream().map(BadgeDto::name).toList());
    }

    @Test
    void userBelowPointsThresholdEarnsNothing() {
        when(badgeRepository.findAll()).thenReturn(List.of(badge(1L, "POINTS", 100)));

        assertTrue(service.checkAndAwardBadges(user(99)).isEmpty());
    }

    @Test
    void streakAtThresholdEarnsBadgeButOneDayShortDoesNot() {
        when(badgeRepository.findAll()).thenReturn(List.of(badge(1L, "STREAK", 7)));
        User onStreak = user(0);
        onStreak.setStreak(7);
        User shortOfIt = user(0);
        shortOfIt.setStreak(6);

        assertEquals(1, service.checkAndAwardBadges(onStreak).size());
        assertTrue(service.checkAndAwardBadges(shortOfIt).isEmpty());
    }

    @Test
    void expiredStreakDoesNotEarnStreakBadge() {
        when(badgeRepository.findAll()).thenReturn(List.of(badge(1L, "STREAK", 7)));

        assertTrue(service.checkAndAwardBadges(streakUser(7, LocalDate.of(2026, 10, 13))).isEmpty());
        verify(userBadgeRepository, never()).save(any());
    }

    @Test
    void streakLastExtendedYesterdayStillEarnsStreakBadge() {
        when(badgeRepository.findAll()).thenReturn(List.of(badge(1L, "STREAK", 7)));
        when(userRepository.count()).thenReturn(1L);

        assertEquals(1, service.checkAndAwardBadges(streakUser(7, LocalDate.of(2026, 10, 14))).size());
    }

    @Test
    void acceptedFriendshipWithExpiredStreakEarnsOnlyTheFriendsBadge() {
        User alice = streakUser(7, LocalDate.of(2026, 10, 1));
        when(badgeRepository.findAll()).thenReturn(List.of(badge(1L, "STREAK", 7), badge(2L, "FRIENDS_COUNT", 1)));
        when(userRepository.count()).thenReturn(1L);
        when(friendshipRepository.countByUserIdAndStatus(7L, FriendshipStatus.ACCEPTED)).thenReturn(1L);

        var earned = service.checkAndAwardBadges(alice);

        assertEquals(List.of("FRIENDS_COUNT 1"), earned.stream().map(BadgeDto::name).toList());
    }

    @Test
    void expiredStreakKeepsPreviouslyEarnedStreakBadgeAndStreakValue() {
        User alice = streakUser(7, LocalDate.of(2026, 10, 1));
        when(badgeRepository.findAll()).thenReturn(List.of(badge(1L, "STREAK", 7)));
        when(userBadgeRepository.findEarnedBadgeRowsByUserId(7L)).thenReturn(List.of(new Row(1L, LocalDateTime.of(2026, 9, 1, 0, 0))));
        stubUser(alice);

        assertTrue(service.checkAndAwardBadges(alice).isEmpty());

        assertEquals(List.of("STREAK 7"), service.getUserBadges(7L).stream().map(BadgeDto::name).toList());
        assertEquals(7, alice.getStreak());
        assertEquals(LocalDate.of(2026, 10, 1), alice.getLastSolvedDate());
        verify(userBadgeRepository, never()).delete(any());
        verify(userBadgeRepository, never()).deleteAll(any());
        verify(userBadgeRepository, never()).deleteByUserId(any());
    }

    @Test
    void solvedRoomCountAtThresholdEarnsBadgeButOneShortDoesNot() {
        when(badgeRepository.findAll()).thenReturn(List.of(badge(1L, "SOLVED_COUNT", 10)));
        when(userSolvedRoomRepository.countByUser_Id(7L)).thenReturn(10L, 9L);

        assertEquals(1, service.checkAndAwardBadges(user(0)).size());
        assertTrue(service.checkAndAwardBadges(user(0)).isEmpty());
    }

    @Test
    void friendCountAtThresholdEarnsBadgeButOneShortDoesNot() {
        User alice = user(0);
        when(badgeRepository.findAll()).thenReturn(List.of(badge(1L, "FRIENDS_COUNT", 3)));
        when(friendshipRepository.countByUserIdAndStatus(7L, FriendshipStatus.ACCEPTED)).thenReturn(3L, 2L);

        assertEquals(1, service.checkAndAwardBadges(alice).size());
        assertTrue(service.checkAndAwardBadges(alice).isEmpty());
    }

    @Test
    void alreadyEarnedBadgeIsNotAwardedAgain() {
        when(badgeRepository.findAll()).thenReturn(List.of(badge(1L, "POINTS", 100), badge(2L, "POINTS", 50)));
        when(userBadgeRepository.findEarnedBadgeRowsByUserId(7L)).thenReturn(List.of(new Row(1L, LocalDateTime.now())));

        var earned = service.checkAndAwardBadges(user(500));

        assertEquals(List.of("POINTS 50"), earned.stream().map(BadgeDto::name).toList());
    }

    @Test
    void badgeWithUnknownConditionIsNeverAwarded() {
        when(badgeRepository.findAll()).thenReturn(List.of(badge(1L, "ARENA_WINS", 0)));

        assertTrue(service.checkAndAwardBadges(user(10_000)).isEmpty());
    }

    @Test
    void newBadgeRarityCountsTheUserWhoJustEarnedIt() {
        when(badgeRepository.findAll()).thenReturn(List.of(badge(1L, "POINTS", 100)));
        when(userRepository.count()).thenReturn(4L);
        when(userBadgeRepository.countAllBadges()).thenReturn(List.<Object[]>of(new Object[] {1L, 1L}));

        var earned = service.checkAndAwardBadges(user(100)).get(0);

        assertTrue(earned.earned());
        assertEquals(50.0, earned.rarityPercentage());
    }

    @Test
    void rarityWithNoUsersTreatsPopulationAsOne() {
        when(badgeRepository.findAll()).thenReturn(List.of(badge(1L, "POINTS", 100)));
        when(userRepository.count()).thenReturn(0L);

        assertEquals(100.0, service.checkAndAwardBadges(user(100)).get(0).rarityPercentage());
    }

    // ── status and progress ─────────────────────────────────────────────────

    @Test
    void earnedBadgeCarriesAcquisitionDateAndRarity() {
        LocalDateTime earnedAt = LocalDateTime.of(2026, 9, 1, 10, 0);
        when(badgeRepository.findAll()).thenReturn(List.of(badge(1L, "POINTS", 100), badge(2L, "POINTS", 500)));
        when(userBadgeRepository.findEarnedBadgeRowsByUserId(7L)).thenReturn(List.of(new Row(1L, earnedAt)));
        when(userBadgeRepository.countAllBadges()).thenReturn(List.<Object[]>of(new Object[] {1L, 2L}));
        when(userRepository.count()).thenReturn(8L);
        stubUser(user(150));

        var badges = service.getAllBadgesWithStatus(7L);

        assertTrue(badges.get(0).earned());
        assertEquals(earnedAt, badges.get(0).earnedAt());
        assertEquals(25.0, badges.get(0).rarityPercentage());
        assertFalse(badges.get(1).earned());
        assertNull(badges.get(1).earnedAt());
        assertEquals(0.0, badges.get(1).rarityPercentage());
    }

    @Test
    void rarityInStatusWithNoUsersTreatsPopulationAsOne() {
        when(badgeRepository.findAll()).thenReturn(List.of(badge(1L, "POINTS", 100)));
        when(userBadgeRepository.countAllBadges()).thenReturn(List.<Object[]>of(new Object[] {1L, 1L}));
        stubUser(user(0));

        assertEquals(100.0, service.getAllBadgesWithStatus(7L).get(0).rarityPercentage());
    }

    @Test
    void progressIsClampedToTarget() {
        when(badgeRepository.findAll()).thenReturn(List.of(badge(1L, "POINTS", 100), badge(2L, "SOLVED_COUNT", 5)));
        when(userSolvedRoomRepository.countByUser_Id(7L)).thenReturn(12L);
        stubUser(user(30));

        var badges = service.getAllBadgesWithStatus(7L);

        assertEquals(new BadgeProgressDto(30, 100, "POINTS"), badges.get(0).progress());
        assertEquals(new BadgeProgressDto(5, 5, "SOLVED_COUNT"), badges.get(1).progress());
    }

    @Test
    void earnedBadgeShowsFullProgressEvenIfValueDroppedSince() {
        when(badgeRepository.findAll()).thenReturn(List.of(badge(1L, "FRIENDS_COUNT", 3)));
        when(userBadgeRepository.findEarnedBadgeRowsByUserId(7L)).thenReturn(List.of(new Row(1L, LocalDateTime.of(2026, 1, 1, 0, 0))));
        when(friendshipRepository.countByUserIdAndStatus(7L, FriendshipStatus.ACCEPTED)).thenReturn(1L);
        stubUser(user(0));

        assertEquals(new BadgeProgressDto(3, 3, "FRIENDS_COUNT"), service.getAllBadgesWithStatus(7L).get(0).progress());
    }

    @Test
    void badgeWithUnknownConditionHasNoProgress() {
        when(badgeRepository.findAll()).thenReturn(List.of(badge(1L, "ARENA_WINS", 3)));
        stubUser(user(0));

        assertNull(service.getAllBadgesWithStatus(7L).get(0).progress());
    }

    @Test
    void streakLastExtendedYesterdayStillCounts() {
        when(badgeRepository.findAll()).thenReturn(List.of(badge(1L, "STREAK", 7)));
        stubUser(streakUser(5, LocalDate.of(2026, 10, 14)));

        assertEquals(5, service.getAllBadgesWithStatus(7L).get(0).progress().current());
    }

    @Test
    void streakNotExtendedSinceTheDayBeforeYesterdayHasExpired() {
        when(badgeRepository.findAll()).thenReturn(List.of(badge(1L, "STREAK", 7)));
        stubUser(streakUser(5, LocalDate.of(2026, 10, 13)));

        assertEquals(0, service.getAllBadgesWithStatus(7L).get(0).progress().current());
    }

    @Test
    void userBadgesListOnlyEarnedOnes() {
        when(badgeRepository.findAll()).thenReturn(List.of(badge(1L, "POINTS", 100), badge(2L, "POINTS", 500)));
        when(userBadgeRepository.findEarnedBadgeRowsByUserId(7L)).thenReturn(List.of(new Row(2L, LocalDateTime.of(2026, 1, 1, 0, 0))));
        stubUser(user(600));

        assertEquals(List.of("POINTS 500"), service.getUserBadges(7L).stream().map(BadgeDto::name).toList());
    }

    @Test
    void statusForUnknownUserFails() {
        when(userRepository.findById(7L)).thenReturn(Optional.empty());

        assertThrows(UserNotFoundException.class, () -> service.getAllBadgesWithStatus(7L));
    }

    @Test
    void awardingBadgeRefreshesRarityShownInStatus() {
        when(badgeRepository.findAll()).thenReturn(List.of(badge(1L, "POINTS", 100)));
        when(userRepository.count()).thenReturn(1L);
        when(userBadgeRepository.countAllBadges()).thenReturn(List.of(), List.<Object[]>of(new Object[] {1L, 1L}));
        User alice = user(150);
        stubUser(alice);
        assertEquals(0.0, service.getAllBadgesWithStatus(7L).get(0).rarityPercentage());

        service.checkAndAwardBadges(alice);

        assertEquals(100.0, service.getAllBadgesWithStatus(7L).get(0).rarityPercentage());
    }

    @Test
    void statusIsServedFromCacheWhenNothingWasAwarded() {
        Badge first = badge(1L, "POINTS", 100);
        when(badgeRepository.findAll()).thenReturn(List.of(first), List.of(first, badge(2L, "POINTS", 200)));
        stubUser(user(0));

        service.getAllBadgesWithStatus(7L);

        assertEquals(1, service.getAllBadgesWithStatus(7L).size());
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    static Badge badge(Long id, String type, int value) {
        Badge badge = new Badge(type + " " + value, "Opis", "icon", type, value);
        badge.setId(id);
        return badge;
    }

    static User user(int points) {
        User user = User.builder().username("alice").points(points).build();
        user.setId(7L);
        return user;
    }

    static User streakUser(int streak, LocalDate lastSolved) {
        User user = user(0);
        user.setStreak(streak);
        user.setLastSolvedDate(lastSolved);
        return user;
    }

    void stubUser(User user) {
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
    }

    record Row(Long getBadgeId, LocalDateTime getEarnedAt) implements UserBadgeRepository.EarnedBadgeRow {}
}
