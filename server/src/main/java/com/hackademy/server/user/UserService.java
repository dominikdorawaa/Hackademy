package com.hackademy.server.user;

import com.hackademy.server.dashboard.ActivityDto;
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

import java.util.List;

public interface UserService {
    UserAvatarDto getAvatar(Long userId);
    UserAvatarDto saveAvatar(Long userId, UserAvatarDto avatar);
    void deleteAvatar(Long userId);
    ProfilePersonalizationDto getPersonalization(Long userId);
    ProfilePersonalizationDto updateProfile(Long userId, UpdateProfileRequest request);
    List<UserAdminView> findAllUsers();
    org.springframework.data.domain.Slice<UserAdminView> findUsersPage(int page, int size, String query);
    void deleteUser(Long id);
    void deleteOwnAccount(Long id, String password, String confirmation);
    UserAdminView updateUserRole(Long id, Role newRole);
    String updateUsername(Long userId, UpdateUsernameRequest request);

    UsernameAvailabilityDto usernameAvailability(Long userId, String username);
    List<RankingEntry> getTop10Ranking();
    UserProfileDto getPublicProfile(String username);
    ProfileStatsDto getProfileStats(Long userId);
    ProfilePortfolioDto getProfilePortfolio(Long userId);
    void updateBio(Long userId, UpdateBioRequest request);
    List<UserSearchDto> searchUsers(String query, Long currentUserId);
    Long getUserIdByUsername(String username);
    RankingEntry getUserRank(Long userId); // New method
    boolean hasSolvedTutorialVpn(Long userId); // New method
    List<ActivityDto> getUserActivity(Long userId); // New method
    List<RecentSolvedRoomDto> getRecentSolvedRooms(Long userId, int limit);
    int recordActivity(Long userId, boolean active);
    int getActiveSecondsThisWeek(Long userId);
}
