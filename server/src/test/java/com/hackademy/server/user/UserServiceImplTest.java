package com.hackademy.server.user;

import com.hackademy.server.auth.JwtService;
import com.hackademy.server.badge.BadgeDto;
import com.hackademy.server.badge.BadgeService;
import com.hackademy.server.badge.UserBadgeRepository;
import com.hackademy.server.dashboard.ActivityDto;
import com.hackademy.server.dashboard.ActivityWeek;
import com.hackademy.server.dashboard.UserWeeklyActiveTime;
import com.hackademy.server.dashboard.UserWeeklyActiveTimeId;
import com.hackademy.server.dashboard.UserWeeklyActiveTimeRepository;
import com.hackademy.server.exception.UserNotFoundException;
import com.hackademy.server.friendship.FriendshipService;
import com.hackademy.server.path.PathRepository;
import com.hackademy.server.ranking.RankingEntry;
import com.hackademy.server.room.DifficultyLevel;
import com.hackademy.server.room.RecentSolvedRoomView;
import com.hackademy.server.room.UserSolvedRoomRepository;
import com.hackademy.server.room.UserUnlockedHintRepository;
import com.hackademy.server.room.dto.RecentSolvedRoomDto;
import com.hackademy.server.user.dto.ProfilePersonalizationDto;
import com.hackademy.server.user.dto.ProfilePortfolioDto;
import com.hackademy.server.user.dto.ProfileStatsDto;
import com.hackademy.server.user.dto.UpdateBioRequest;
import com.hackademy.server.user.dto.UpdateProfileRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {

    @Mock UserRepository userRepository;
    @Mock UserSolvedRoomRepository userSolvedRoomRepository;
    @Mock UserBadgeRepository userBadgeRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock JwtService jwtService;
    @Mock FriendshipService friendshipService;
    @Mock BadgeService badgeService;
    @Mock UserWeeklyActiveTimeRepository userWeeklyActiveTimeRepository;
    @Mock UserUnlockedHintRepository userUnlockedHintRepository;
    @Mock PathRepository pathRepository;
    @InjectMocks UserServiceImpl service;

    @AfterEach
    void clearTransactionSynchronization() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    // ── personalization ─────────────────────────────────────────────────────

    @Test
    void updatesPersonalizationAndInvalidatesCachesAfterCommit() {
        var user = user(1L, "alice");
        user.getInterests().add("LINUX");
        user.getFeaturedBadgeIds().add(9L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(badgeService.getAllBadgesWithStatus(1L)).thenReturn(List.of(badge(3L, true), badge(4L, false)));
        TransactionSynchronizationManager.initSynchronization();

        var result = service.updateProfile(1L, new UpdateProfileRequest(
                "  Bio  ", " Tagline ", " seed ", List.of("WEB", "SOC"), List.of(3L)));

        assertEquals(new ProfilePersonalizationDto("Bio", "Tagline", "seed", List.of("WEB", "SOC"), List.of(3L)), result);
        verify(userRepository).saveAndFlush(user);
        verifyNoInteractions(friendshipService);

        TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
        verify(friendshipService).invalidateProfileCaches();
    }

    @Test
    void rejectsInvalidPersonalization() {
        assertInvalidProfile(List.of("COOKING"), List.of());
        assertInvalidProfile(List.of("WEB", "WEB"), List.of());
        assertInvalidProfile(List.of("WEB"), List.of(3L, 3L));
        verifyNoInteractions(badgeService);

        when(badgeService.getAllBadgesWithStatus(1L)).thenReturn(List.of(badge(3L, true), badge(4L, false)));
        assertInvalidProfile(List.of("WEB"), List.of(4L));
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    void updatingProfileOfMissingUserFails() {
        when(badgeService.getAllBadgesWithStatus(1L)).thenReturn(List.of());
        when(userRepository.findById(1L)).thenReturn(Optional.empty());

        assertThrows(UserNotFoundException.class, () -> service.updateProfile(1L,
                new UpdateProfileRequest("", "", "seed", List.of(), List.of())));
    }

    private void assertInvalidProfile(List<String> interests, List<Long> badges) {
        assertThrows(IllegalArgumentException.class, () -> service.updateProfile(1L,
                new UpdateProfileRequest("", "", "seed", interests, badges)));
    }

    @Test
    void personalizationReplacesMissingBioWithEmptyText() {
        var user = user(1L, "alice");
        user.setTagline("Hacker");
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.findById(2L)).thenReturn(Optional.empty());

        assertEquals(new ProfilePersonalizationDto("", "Hacker", "alice-seed", List.of(), List.of()),
                service.getPersonalization(1L));
        assertThrows(UserNotFoundException.class, () -> service.getPersonalization(2L));
    }

    // ── stats and portfolio ─────────────────────────────────────────────────

    @Test
    void assemblesProfileStats() {
        var user = user(1L, "alice");
        user.setElo(812);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userSolvedRoomRepository.countByUser_Id(1L)).thenReturn(12L);
        when(userUnlockedHintRepository.countByUser_Id(1L)).thenReturn(4L);
        when(userBadgeRepository.countByUser_Id(1L)).thenReturn(3L);
        when(pathRepository.countCompletedByUserId(1L)).thenReturn(2L);

        assertEquals(new ProfileStatsDto(12, 4, 3, 812, 2), service.getProfileStats(1L));

        when(userRepository.findById(2L)).thenReturn(Optional.empty());
        assertThrows(UserNotFoundException.class, () -> service.getProfileStats(2L));
    }

    @Test
    void portfolioListsPracticeAreasAndOnlyCompletedPaths() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user(1L, "alice")));
        when(userSolvedRoomRepository.findPracticeAreas(1L)).thenReturn(List.of(new Area("Web", 5L)));
        when(pathRepository.findProgressForUsername("alice")).thenReturn(List.of(
                new Progress(1L, "Gotowa", 3, 3),
                new Progress(2L, "W toku", 3, 1),
                new Progress(3L, "Pusta", 0, 0)));

        assertEquals(new ProfilePortfolioDto(
                        List.of(new ProfilePortfolioDto.PracticeArea("Web", 5)),
                        List.of(new ProfilePortfolioDto.CompletedPath(1L, "Gotowa", 3))),
                service.getProfilePortfolio(1L));

        when(userRepository.findById(2L)).thenReturn(Optional.empty());
        assertThrows(UserNotFoundException.class, () -> service.getProfilePortfolio(2L));
    }

    @Test
    void portfolioFailsWhenPathTotalIsMissing() {
        // Pins current behaviour: getMyPathsProgress treats a null total as 0, the portfolio throws instead.
        when(userRepository.findById(1L)).thenReturn(Optional.of(user(1L, "alice")));
        when(pathRepository.findProgressForUsername("alice")).thenReturn(List.of(new Progress(1L, "Pusta", null, null)));

        assertThrows(NullPointerException.class, () -> service.getProfilePortfolio(1L));
    }

    @Test
    void publicProfileResetsStaleStreak() {
        var user = user(1L, "alice");
        user.setStreak(7);
        user.setLastSolvedDate(LocalDate.now().minusDays(2));
        user.getInterests().add("WEB");
        var badges = List.of(badge(3L, true));
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(badgeService.getAllBadgesWithStatus(1L)).thenReturn(badges);

        var profile = service.getPublicProfile("alice");

        assertEquals(0, profile.streak());
        assertEquals("alice", profile.username());
        assertEquals(List.of("WEB"), profile.interests());
        assertSame(badges, profile.badges());

        user.setLastSolvedDate(LocalDate.now().minusDays(1));
        assertEquals(7, service.getPublicProfile("alice").streak());
        user.setLastSolvedDate(null);
        assertEquals(7, service.getPublicProfile("alice").streak());

        when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());
        assertThrows(UserNotFoundException.class, () -> service.getPublicProfile("ghost"));
    }

    // ── ranking ─────────────────────────────────────────────────────────────

    @Test
    void topRankingIsCachedUntilInvalidated() {
        var alice = user(1L, "alice");
        alice.setPoints(300);
        alice.setElo(700);
        when(userRepository.findTopByPointsDesc(PageRequest.of(0, 100))).thenReturn(List.of(alice));

        var ranking = service.getTop10Ranking();

        assertEquals(List.of(new RankingEntry(0, 0, "alice", 300, 700, "alice-seed")), ranking);
        assertSame(ranking, service.getTop10Ranking());
        verify(userRepository, times(1)).findTopByPointsDesc(any());

        service.invalidateGlobalRankingCache();
        service.getTop10Ranking();
        verify(userRepository, times(2)).findTopByPointsDesc(any());
    }

    @Test
    void userRankCountsUsersAheadAndIsCached() {
        var alice = user(1L, "alice");
        alice.setPoints(300);
        alice.setElo(700);
        when(userRepository.findById(1L)).thenReturn(Optional.of(alice));
        when(userRepository.countByPointsGreaterThan(300)).thenReturn(4L);
        when(userRepository.countByEloGreaterThan(700)).thenReturn(1L);

        var rank = service.getUserRank(1L);

        assertEquals(new RankingEntry(5, 2, "alice", 300, 700, "alice-seed"), rank);
        assertSame(rank, service.getUserRank(1L));
        assertSame(rank, service.getUserRankFast(1L, "alice", 0, 0));
        verify(userRepository, times(1)).findById(1L);

        service.invalidateUserComputedCaches(1L);
        service.invalidateUserComputedCaches(null);
        service.getUserRank(1L);
        verify(userRepository, times(2)).findById(1L);

        when(userRepository.findById(2L)).thenReturn(Optional.empty());
        assertThrows(UserNotFoundException.class, () -> service.getUserRank(2L));
    }

    @Test
    void fastRankUsesDefaultsAndFallsBackToUsernameAvatar() {
        when(userRepository.countByPointsGreaterThan(0)).thenReturn(9L);
        when(userRepository.countByEloGreaterThan(500)).thenReturn(3L);
        when(userRepository.findById(1L)).thenReturn(Optional.empty());

        assertEquals(new RankingEntry(10, 4, "alice", 0, 500, "alice"), service.getUserRankFast(1L, "alice", null, null));
    }

    // ── search, moderation and tutorials ────────────────────────────────────

    @Test
    void searchMarksSelfAndOtherFriendshipStatuses() {
        when(userRepository.findByUsernameContainingIgnoreCase("a"))
                .thenReturn(List.of(user(1L, "alice"), user(2L, "adam")));
        when(friendshipService.getFriendshipStatus(1L, "adam")).thenReturn("FRIENDS");

        var results = service.searchUsers("a", 1L);

        assertEquals("SELF", results.get(0).friendshipStatus());
        assertEquals("FRIENDS", results.get(1).friendshipStatus());
        assertEquals("adam-seed", results.get(1).avatarSeed());
        verify(friendshipService, never()).getFriendshipStatus(1L, "alice");
    }

    @Test
    void mutesTemporarilyOrPermanentlyInUtc() {
        var user = user(1L, "alice");
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        var now = LocalDateTime.now(ZoneOffset.UTC);

        service.muteUser(1L, 60);
        assertTrue(user.getMutedUntil().isAfter(now.plusSeconds(59)));
        assertTrue(user.getMutedUntil().isBefore(now.plusMinutes(5)));

        service.muteUser(1L, -1);
        assertTrue(user.getMutedUntil().isAfter(now.plusYears(99)));
        verify(userRepository, times(2)).save(user);

        when(userRepository.findById(2L)).thenReturn(Optional.empty());
        assertThrows(UserNotFoundException.class, () -> service.muteUser(2L, 60));
    }

    @Test
    void eitherTutorialCountsAndResultIsCached() {
        when(userSolvedRoomRepository.existsByUser_IdAndRoom_Title(1L, "Tutorial VPN")).thenReturn(false);
        when(userSolvedRoomRepository.existsByUser_IdAndRoom_Title(1L, "Tutorial VM")).thenReturn(true);
        when(userSolvedRoomRepository.existsByUser_IdAndRoom_Title(2L, "Tutorial VPN")).thenReturn(true);

        assertTrue(service.hasSolvedTutorialVpn(1L));
        assertTrue(service.hasSolvedTutorialVpn(1L));
        assertTrue(service.hasSolvedTutorialVpn(2L));
        verify(userSolvedRoomRepository, times(1)).existsByUser_IdAndRoom_Title(1L, "Tutorial VM");
        verify(userSolvedRoomRepository, never()).existsByUser_IdAndRoom_Title(2L, "Tutorial VM");
    }

    // ── activity ────────────────────────────────────────────────────────────

    @Test
    void recentSolvedRoomsClampLimitAndDefaultPoints() {
        var solvedAt = LocalDateTime.of(2026, 10, 1, 12, 0);
        when(userSolvedRoomRepository.findRecentSolvedRooms(1L, 20))
                .thenReturn(List.of(new Recent(7L, "Web", DifficultyLevel.values()[0], null, solvedAt)));

        assertEquals(List.of(new RecentSolvedRoomDto(7L, "Web", DifficultyLevel.values()[0], 0, solvedAt)),
                service.getRecentSolvedRooms(1L, 100));
        service.getRecentSolvedRooms(1L, 0);
        verify(userSolvedRoomRepository).findRecentSolvedRooms(1L, 1);
    }

    @Test
    void activityCoversLastYear() {
        var activity = List.of(mock(ActivityDto.class));
        when(userSolvedRoomRepository.findUserActivity(eq(1L), any())).thenReturn(activity);

        assertSame(activity, service.getUserActivity(1L));
        var since = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(userSolvedRoomRepository).findUserActivity(eq(1L), since.capture());
        assertTrue(since.getValue().isBefore(LocalDateTime.now().minusDays(364)));
    }

    @Test
    void addsClampedActiveSecondsToCurrentWeek() {
        var id = new UserWeeklyActiveTimeId(1L, ActivityWeek.currentKey());
        var row = new UserWeeklyActiveTime(1L, ActivityWeek.currentKey(), 100, null);
        when(userWeeklyActiveTimeRepository.findById(id)).thenReturn(Optional.of(row));
        when(userWeeklyActiveTimeRepository.save(row)).thenReturn(row);

        assertEquals(160, service.addActiveSecondsThisWeek(1L, 500));
        assertEquals(160, service.addActiveSecondsThisWeek(1L, -5));
    }

    @Test
    void startsNewWeekRowAndToleratesMissingTable() {
        when(userWeeklyActiveTimeRepository.findById(any())).thenReturn(Optional.empty());
        when(userWeeklyActiveTimeRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        assertEquals(30, service.addActiveSecondsThisWeek(1L, 30));
        assertEquals(0, service.getActiveSecondsThisWeek(1L));

        when(userWeeklyActiveTimeRepository.findById(any())).thenThrow(new IllegalStateException("no table"));
        assertEquals(0, service.addActiveSecondsThisWeek(1L, 30));
        assertEquals(0, service.getActiveSecondsThisWeek(1L));
    }

    // ── admin and simple updates ────────────────────────────────────────────

    @Test
    void listsUsersForAdmin() {
        var user = user(1L, "alice");
        user.setEmail("alice@example.com");
        when(userRepository.findAll()).thenReturn(List.of(user));

        var users = service.findAllUsers();

        assertEquals(1, users.size());
        assertEquals("alice@example.com", users.get(0).email());
    }

    @Test
    void deletesUserWithBadges() {
        when(userRepository.existsById(1L)).thenReturn(true);
        when(userRepository.existsById(2L)).thenReturn(false);

        service.deleteUser(1L);
        verify(userBadgeRepository).deleteByUserId(1L);
        verify(userRepository).deleteById(1L);

        assertThrows(UserNotFoundException.class, () -> service.deleteUser(2L));
    }

    @Test
    void changesRole() {
        var user = user(1L, "alice");
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);
        when(userRepository.findById(2L)).thenReturn(Optional.empty());

        assertEquals(Role.EXPERT, service.updateUserRole(1L, Role.EXPERT).role());
        assertThrows(UserNotFoundException.class, () -> service.updateUserRole(2L, Role.ADMIN));
    }

    @Test
    void updatesBio() {
        var user = user(1L, "alice");
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.findById(2L)).thenReturn(Optional.empty());

        service.updateBio(1L, new UpdateBioRequest("Nowe bio"));

        assertEquals("Nowe bio", user.getBio());
        verify(userRepository).save(user);
        assertThrows(UserNotFoundException.class, () -> service.updateBio(2L, new UpdateBioRequest("x")));
    }

    @Test
    void findsUserIdByUsername() {
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user(1L, "alice")));
        when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());

        assertEquals(1L, service.getUserIdByUsername("alice"));
        assertThrows(UserNotFoundException.class, () -> service.getUserIdByUsername("ghost"));
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private static User user(long id, String username) {
        return User.builder().id(id).username(username).avatarSeed(username + "-seed").build();
    }

    private static BadgeDto badge(long id, boolean earned) {
        return new BadgeDto(id, "Badge " + id, "", "", null, earned, 0);
    }

    private record Area(String getCategory, Long getSolvedRooms) implements UserSolvedRoomRepository.PracticeAreaView {}

    private record Progress(Long getId, String getTitle, Integer getTotalRooms, Integer getSolvedRooms)
            implements PathRepository.PathProgressView {
        @Override public String getDescription() { return null; }
        @Override public String getBannerUrl() { return null; }
        @Override public Boolean getHasBanner() { return false; }
        @Override public Boolean getPublished() { return true; }
    }

    private record Recent(Long getRoomId, String getTitle, DifficultyLevel getDifficulty, Integer getPoints,
                          LocalDateTime getSolvedAt) implements RecentSolvedRoomView {}
}
