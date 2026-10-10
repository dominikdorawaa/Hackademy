package com.hackademy.server.user;

import com.hackademy.server.dashboard.ActivityDto;
import com.hackademy.server.auth.AuthResponse;
import com.hackademy.server.user.dto.ChangePasswordRequest;
import com.hackademy.server.room.dto.RecentSolvedRoomDto;
import com.hackademy.server.ranking.RankingEntry;
import com.hackademy.server.user.dto.UpdateBioRequest;
import com.hackademy.server.user.dto.UpdateUsernameRequest;
import com.hackademy.server.admin.UserAdminView;
import com.hackademy.server.user.dto.UserProfileDto;
import com.hackademy.server.user.dto.ProfileStatsDto;
import com.hackademy.server.user.dto.ProfilePortfolioDto;
import com.hackademy.server.user.dto.UserSearchDto;
import com.hackademy.server.user.dto.ProfilePersonalizationDto;
import com.hackademy.server.user.dto.UpdateProfileRequest;

import java.util.List;

public interface UserService {
    ProfilePersonalizationDto getPersonalization(Long userId);
    ProfilePersonalizationDto updateProfile(Long userId, UpdateProfileRequest request);
    List<UserAdminView> findAllUsers();
    void deleteUser(Long id);
    UserAdminView updateUserRole(Long id, Role newRole);
    void changePassword(Long userId, ChangePasswordRequest request);
    AuthResponse updateUsername(Long userId, UpdateUsernameRequest request);
    List<RankingEntry> getTop10Ranking();
    UserProfileDto getPublicProfile(String username);
    ProfileStatsDto getProfileStats(Long userId);
    ProfilePortfolioDto getProfilePortfolio(Long userId);
    void updateBio(Long userId, UpdateBioRequest request);
    List<UserSearchDto> searchUsers(String query, Long currentUserId);
    Long getUserIdByUsername(String username);
    void muteUser(Long userId, long durationInSeconds);
    RankingEntry getUserRank(Long userId); // New method
    boolean hasSolvedTutorialVpn(Long userId); // New method
    List<ActivityDto> getUserActivity(Long userId); // New method
    List<RecentSolvedRoomDto> getRecentSolvedRooms(Long userId, int limit);
    int addActiveSecondsThisWeek(Long userId, int deltaSeconds);
    int getActiveSecondsThisWeek(Long userId);
}
