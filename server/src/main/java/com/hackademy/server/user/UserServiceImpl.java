package com.hackademy.server.user;

import com.hackademy.server.badge.BadgeService;
import com.hackademy.server.dashboard.UserWeeklyActiveTime;
import com.hackademy.server.dashboard.UserWeeklyActiveTimeId;
import com.hackademy.server.friendship.FriendshipService;
import com.hackademy.server.room.UserSolvedRoom;
import com.hackademy.server.room.UserUnlockedHintRepository;
import com.hackademy.server.path.PathRepository;

import com.hackademy.server.dashboard.ActivityDto;
import com.hackademy.server.badge.BadgeDto;
import com.hackademy.server.room.dto.RecentSolvedRoomDto;
import com.hackademy.server.ranking.RankingEntry;
import com.hackademy.server.user.dto.UpdateBioRequest;
import com.hackademy.server.user.dto.UpdateUsernameRequest;
import com.hackademy.server.user.dto.UsernameAvailabilityDto;
import com.hackademy.server.admin.UserAdminView;
import com.hackademy.server.user.dto.UserProfileDto;
import com.hackademy.server.user.dto.ProfileStatsDto;
import com.hackademy.server.user.dto.ProfilePortfolioDto;
import com.hackademy.server.user.dto.UserSearchDto;
import com.hackademy.server.user.dto.ProfilePersonalizationDto;
import com.hackademy.server.user.dto.UpdateProfileRequest;
import com.hackademy.server.user.dto.UserAvatarDto;
import com.hackademy.server.exception.UserNotFoundException;
import com.hackademy.server.badge.UserBadgeRepository;
import com.hackademy.server.room.UserSolvedRoomRepository;
import com.hackademy.server.room.RecentSolvedRoomView;
import com.hackademy.server.dashboard.UserWeeklyActiveTimeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.HashSet;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private static final Set<String> PROFILE_INTERESTS = Set.of(
            "WEB", "NETWORKS", "LINUX", "WINDOWS", "PENTESTING", "SOC", "FORENSICS", "CRYPTOGRAPHY", "REVERSE_ENGINEERING", "PROGRAMMING");

    private ProfilePersonalizationDto personalization(User user) {
        return new ProfilePersonalizationDto(
                user.getBio() == null ? "" : user.getBio(), user.getTagline(),
                List.copyOf(user.getInterests()), List.copyOf(user.getFeaturedBadgeIds()));
    }

    @Override
    @Transactional(readOnly = true)
    public ProfilePersonalizationDto getPersonalization(Long userId) {
        return personalization(userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found")));
    }

    @Override
    @Transactional
    public ProfilePersonalizationDto updateProfile(Long userId, UpdateProfileRequest request) {
        if (!PROFILE_INTERESTS.containsAll(request.interests()) ||
                new HashSet<>(request.interests()).size() != request.interests().size() ||
                new HashSet<>(request.featuredBadgeIds()).size() != request.featuredBadgeIds().size()) {
            throw new IllegalArgumentException("Nieprawidłowe lub powtórzone zainteresowania albo odznaki.");
        }
        var earnedIds = badgeService.getAllBadgesWithStatus(userId).stream()
                .filter(BadgeDto::earned).map(BadgeDto::id).collect(Collectors.toSet());
        if (!earnedIds.containsAll(request.featuredBadgeIds())) {
            throw new IllegalArgumentException("Możesz wyróżnić tylko własne zdobyte odznaki.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));
        user.setBio(request.bio().strip());
        user.setTagline(request.tagline().strip());
        user.getInterests().clear();
        user.getInterests().addAll(request.interests());
        user.getFeaturedBadgeIds().clear();
        user.getFeaturedBadgeIds().addAll(request.featuredBadgeIds());
        userRepository.saveAndFlush(user);
        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        invalidateGlobalRankingCache();
                        rankCache.invalidateAll();
                        friendshipService.invalidateProfileCaches(userId);
                    }
                });
        return personalization(user);
    }

    private final UserRepository userRepository;
    private final com.hackademy.server.friendship.FriendshipRepository friendships;
    private final AccountDeletionService accountDeletionService;
    private final UserSolvedRoomRepository userSolvedRoomRepository;
    private final UserBadgeRepository userBadgeRepository; // Inject UserBadgeRepository
    private final FriendshipService friendshipService;
    private final BadgeService badgeService;
    private final UserWeeklyActiveTimeRepository userWeeklyActiveTimeRepository;
    private final UserUnlockedHintRepository userUnlockedHintRepository;
    private final PathRepository pathRepository;
    private final UserAvatarRepository userAvatarRepository;
    private final com.hackademy.server.dashboard.DashboardSummaryCache dashboardSummaryCache;
    private final ApplicationEventPublisher events;

    @Override
    @Transactional(readOnly = true)
    public ProfileStatsDto getProfileStats(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));
        return new ProfileStatsDto(
                userSolvedRoomRepository.countByUser_Id(userId),
                userUnlockedHintRepository.countByUser_Id(userId),
                userBadgeRepository.countByUser_Id(userId), user.getElo(), pathRepository.countCompletedByUserId(userId));
    }

    @Override
    @Transactional(readOnly = true)
    public ProfilePortfolioDto getProfilePortfolio(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));
        var areas = userSolvedRoomRepository.findPracticeAreas(userId).stream()
                .map(row -> new ProfilePortfolioDto.PracticeArea(
                        row.getCategory(), row.getSolvedRooms())).toList();
        var paths = pathRepository.findProgressForUsername(user.getUsername()).stream()
                .filter(row -> row.getTotalRooms() != null && row.getTotalRooms() > 0
                        && row.getTotalRooms().equals(row.getSolvedRooms()))
                .map(row -> new ProfilePortfolioDto.CompletedPath(
                        row.getId(), row.getTitle(), row.getTotalRooms())).toList();
        return new ProfilePortfolioDto(areas, paths);
    }

    private static final long CACHE_MS = 30_000; // 30 seconds
    private static final class CacheEntry<T> {
        final long timeMs;
        final T value;
        CacheEntry(long timeMs, T value) { this.timeMs = timeMs; this.value = value; }
    }
    private final com.github.benmanes.caffeine.cache.Cache<Long, CacheEntry<RankingEntry>> rankCache = com.hackademy.server.cache.LocalCaches.bounded(1024, java.time.Duration.ofSeconds(30));
    private final com.github.benmanes.caffeine.cache.Cache<Long, CacheEntry<Boolean>> tutorialVpnSolvedCache = com.hackademy.server.cache.LocalCaches.bounded(1024, java.time.Duration.ofSeconds(30));
    private final com.github.benmanes.caffeine.cache.Cache<Integer, List<RankingEntry>> rankingCache = com.hackademy.server.cache.LocalCaches.bounded(1, java.time.Duration.ofSeconds(30));

    public void invalidateUserComputedCaches(Long userId) {
        if (userId == null) return;
        rankCache.invalidate(userId);
        tutorialVpnSolvedCache.invalidate(userId);
    }

    public void invalidateGlobalRankingCache() {
        rankingCache.invalidateAll();
    }

    @Override
    public org.springframework.data.domain.Slice<UserAdminView> findUsersPage(int page, int size, String query) {
        String term = query == null ? "" : query.strip();
        if (term.length() > 64) term = term.substring(0, 64);
        return userRepository.findAdminPage(term, PageRequest.of(Math.max(0, page), Math.max(1, Math.min(100, size))));
    }

    @Override
    public List<UserAdminView> findAllUsers() {
        return userRepository.findAll().stream()
                .map(this::mapUserToUserAdminView)
                .collect(Collectors.toList());
    }

    @Override
    public void deleteUser(Long id) {
        var related = friendships.findRelatedUserIds(id);
        accountDeletionService.delete(id);
        invalidateGlobalRankingCache();
        rankCache.invalidate(id);
        tutorialVpnSolvedCache.invalidate(id);
        friendshipService.invalidateProfileCaches(id, related);
    }

    @Override
    public void deleteOwnAccount(Long id, String password, String confirmation) {
        accountDeletionService.confirmOwner(id, password, confirmation);
        deleteUser(id);
    }

    @Override
    public UserAdminView updateUserRole(Long id, Role newRole) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException("User with ID: " + id + " not found."));
        user.setRole(newRole);
        User updatedUser = userRepository.save(user);
        return mapUserToUserAdminView(updatedUser);
    }

    @Override
    public String updateUsername(Long userId, UpdateUsernameRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        if (takenByAnother(userId, request.newUsername())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, UpdateUsernameRequest.TAKEN_MESSAGE);
        }

        if (user.getUsername().equals(request.newUsername())) {
            return user.getUsername();
        }

        user.setUsername(request.newUsername());
        String saved;
        try {
            saved = userRepository.saveAndFlush(user).getUsername();
        } catch (DataIntegrityViolationException taken) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, UpdateUsernameRequest.TAKEN_MESSAGE);
        }
        refreshProfileCaches(userId);
        return saved;
    }

    @Override
    @Transactional(readOnly = true)
    public UsernameAvailabilityDto usernameAvailability(Long userId, String username) {
        if (username.length() < UpdateUsernameRequest.MIN || username.length() > UpdateUsernameRequest.MAX) {
            return new UsernameAvailabilityDto(false, UsernameAvailabilityDto.LENGTH, UpdateUsernameRequest.LENGTH_MESSAGE);
        }
        if (!username.matches(UpdateUsernameRequest.PATTERN)) {
            return new UsernameAvailabilityDto(false, UsernameAvailabilityDto.CHARACTERS, UpdateUsernameRequest.CHARACTERS_MESSAGE);
        }
        if (takenByAnother(userId, username)) {
            return new UsernameAvailabilityDto(false, UsernameAvailabilityDto.TAKEN, UpdateUsernameRequest.TAKEN_MESSAGE);
        }
        return new UsernameAvailabilityDto(true, null, null);
    }

    private boolean takenByAnother(Long userId, String username) {
        return userRepository.findByUsernameIgnoringCase(username).filter(existing -> !existing.getId().equals(userId)).isPresent();
    }

    @Override
    @Transactional(readOnly = true)
    public UserAvatarDto getAvatar(Long userId) {
        return userAvatarRepository.findDtoByUserId(userId);
    }

    @Override
    @Transactional
    public UserAvatarDto saveAvatar(Long userId, UserAvatarDto avatar) {
        if (!userRepository.existsById(userId)) throw new UserNotFoundException("User not found");
        UserAvatar entity = userAvatarRepository.findById(userId).orElseGet(() -> UserAvatar.of(userId, avatar));
        entity.apply(avatar);
        UserAvatarDto saved = userAvatarRepository.save(entity).toDto();
        refreshAvatarViews(userId);
        return saved;
    }

    @Override
    @Transactional
    public void deleteAvatar(Long userId) {
        userAvatarRepository.findById(userId).ifPresent(userAvatarRepository::delete);
        refreshAvatarViews(userId);
    }

    private void refreshAvatarViews(Long userId) {
        afterCommit(() -> {
            refreshCaches(userId);
            events.publishEvent(new AvatarChangedEvent(userId));
        });
    }

    private void refreshProfileCaches(Long userId) {
        afterCommit(() -> refreshCaches(userId));
    }

    private void refreshCaches(Long userId) {
        invalidateUserComputedCaches(userId);
        invalidateGlobalRankingCache();
        friendshipService.invalidateProfileCaches(userId);
        dashboardSummaryCache.invalidateUser(userId);
    }

    private void afterCommit(Runnable refresh) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            refresh.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                refresh.run();
            }
        });
    }

    @Override
    public List<RankingEntry> getTop10Ranking() {
        return rankingCache.get(0, key -> {
                    List<RankingRow> top = userRepository.findRankingLeaders();
                    Map<Long, UserAvatarDto> avatars = userAvatarRepository.findDtosByUserIds(top.stream().map(RankingRow::getId).toList());
                    List<RankingEntry> out = top.stream()
                            .map(row -> new RankingEntry(
                                    row.getRankPoints(), row.getRankElo(), row.getUsername(),
                                    row.getPoints(), row.getElo(), avatars.get(row.getId())))
                            .collect(Collectors.toList());
            return out;
        });
    }

    @Override
    @Transactional(readOnly = true)
    public UserProfileDto getPublicProfile(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        // Calculate effective streak
        int effectiveStreak = user.getStreak();
        LocalDate lastSolved = user.getLastSolvedDate();
        LocalDate today = LocalDate.now();
        if (lastSolved != null && lastSolved.isBefore(today.minusDays(1))) {
            effectiveStreak = 0;
        }

        // Get badges
        List<BadgeDto> badges = badgeService.getAllBadgesWithStatus(user.getId());

        return UserProfileDto.builder()
                .username(user.getUsername())
                .points(user.getPoints())
                .elo(user.getElo())
                .role(user.getRole())
                .createdAt(user.getCreatedAt())
                .streak(effectiveStreak)
                .bio(user.getBio())
                .tagline(user.getTagline())
                .interests(List.copyOf(user.getInterests()))
                .featuredBadgeIds(List.copyOf(user.getFeaturedBadgeIds()))
                .avatar(userAvatarRepository.findDtoByUserId(user.getId()))
                .badges(badges) // Add badges to DTO
                .build();
    }

    @Override
    public void updateBio(Long userId, UpdateBioRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));
        user.setBio(request.bio());
        userRepository.save(user);
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserSearchDto> searchUsers(String query, Long currentUserId) {
        if (query == null || query.strip().length() < 2) return List.of();
        String normalized = query.strip();
        if (normalized.length() > 64) normalized = normalized.substring(0, 64);
        List<User> users = userRepository.searchLimited(normalized, PageRequest.of(0, 20));
        var statuses = new java.util.HashMap<Long, String>();
        for (var relation : friendships.findForSearch(currentUserId, users.stream().map(User::getId).toList())) {
            boolean outgoing = relation.getRequester().getId().equals(currentUserId);
            statuses.put(outgoing ? relation.getReceiver().getId() : relation.getRequester().getId(),
                    relation.getStatus() == com.hackademy.server.friendship.FriendshipStatus.ACCEPTED
                            ? "FRIENDS" : outgoing ? "REQUEST_SENT" : "REQUEST_RECEIVED");
        }
        Map<Long, UserAvatarDto> avatars = userAvatarRepository.findDtosByUserIds(users.stream().map(User::getId).toList());
        return users.stream()
                .map(user -> {
                    String status = "NONE";
                    if (user.getId().equals(currentUserId)) {
                        status = "SELF";
                    } else {
                        status = statuses.getOrDefault(user.getId(), "NONE");
                    }

                    return UserSearchDto.builder()
                            .id(user.getId())
                            .username(user.getUsername())
                            .avatar(avatars.get(user.getId()))
                            .points(user.getPoints())
                            .friendshipStatus(status)
                            .build();
                })
                .collect(Collectors.toList());
    }

    @Override
    public Long getUserIdByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UserNotFoundException("User not found"));
        return user.getId();
    }

    @Override
    public RankingEntry getUserRank(Long userId) {
        return rankCache.get(userId, key -> {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new UserNotFoundException("User not found"));

            // Calculate rank based on points
            long rankPoints = userRepository.countByPointsGreaterThan(user.getPoints()) + 1;

            // Calculate rank based on ELO
            long rankElo = userRepository.countByEloGreaterThan(user.getElo()) + 1;

            RankingEntry out = new RankingEntry((int) rankPoints, (int) rankElo, user.getUsername(), user.getPoints(), user.getElo(), userAvatarRepository.findDtoByUserId(userId));
            return new CacheEntry<>(System.currentTimeMillis(), out);
        }).value;
    }

    public RankingEntry getUserRankFast(Long userId, String username, Integer points, Integer elo) {
        return rankCache.get(userId, key -> {
            int p = points == null ? 0 : points;
            int e = elo == null ? 500 : elo;
            long rankPoints = userRepository.countByPointsGreaterThan(p) + 1;
            long rankElo = userRepository.countByEloGreaterThan(e) + 1;
            RankingEntry out = new RankingEntry((int) rankPoints, (int) rankElo, username, p, e, userAvatarRepository.findDtoByUserId(userId));
            return new CacheEntry<>(System.currentTimeMillis(), out);
        }).value;
    }

    @Override
    public boolean hasSolvedTutorialVpn(Long userId) {
        return tutorialVpnSolvedCache.get(userId, key -> {
            boolean solved = userSolvedRoomRepository.existsByUser_IdAndRoom_Title(userId, "Tutorial VPN")
                    || userSolvedRoomRepository.existsByUser_IdAndRoom_Title(userId, "Tutorial VM");
            return new CacheEntry<>(System.currentTimeMillis(), solved);
        }).value;
    }

    @Override
    public List<ActivityDto> getUserActivity(Long userId) {
        // Get activity for the last year
        LocalDateTime oneYearAgo = LocalDateTime.now().minusYears(1);
        return userSolvedRoomRepository.findUserActivity(userId, oneYearAgo);
    }

    @Override
    public List<RecentSolvedRoomDto> getRecentSolvedRooms(Long userId, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 20));
        List<RecentSolvedRoomView> rows = userSolvedRoomRepository.findRecentSolvedRooms(userId, safeLimit);
        return rows.stream()
                .map(r -> new RecentSolvedRoomDto(
                        r.getRoomId(),
                        r.getTitle(),
                        r.getDifficulty(),
                        r.getPoints() != null ? r.getPoints() : 0,
                        r.getSolvedAt()
                ))
                .collect(Collectors.toList());
    }

    private String currentWeekKey() {
        return com.hackademy.server.dashboard.ActivityWeek.currentKey();
    }

    @Override
    @Transactional
    public int recordActivity(Long userId, boolean active) {
        return userWeeklyActiveTimeRepository.recordActivity(userId, currentWeekKey(), active);
    }

    @Override
    public int getActiveSecondsThisWeek(Long userId) {
        String weekKey = currentWeekKey();
        var id = new com.hackademy.server.dashboard.UserWeeklyActiveTimeId(userId, weekKey);
        try {
            return userWeeklyActiveTimeRepository.findById(id)
                    .map(com.hackademy.server.dashboard.UserWeeklyActiveTime::getSeconds)
                    .orElse(0);
        } catch (RuntimeException e) {
            // If the table isn't present (e.g. migrations not applied yet), return 0 instead of throwing.
            return 0;
        }
    }

    private UserAdminView mapUserToUserAdminView(User user) {
        return new UserAdminView(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getRole(),
                user.getCreatedAt()
        );
    }
}
