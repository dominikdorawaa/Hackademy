package com.hackademy.server.service;

import com.hackademy.server.dto.AuthResponse;
import com.hackademy.server.dto.ChangePasswordRequest;
import com.hackademy.server.dto.RankingEntry;
import com.hackademy.server.dto.UpdateBioRequest;
import com.hackademy.server.dto.UpdateUsernameRequest;
import com.hackademy.server.dto.UserAdminView;
import com.hackademy.server.dto.UserProfileDto;
import com.hackademy.server.dto.UserSearchDto;
import com.hackademy.server.model.Role;

import java.util.List;

public interface UserService {
    List<UserAdminView> findAllUsers();
    void deleteUser(Long id);
    UserAdminView updateUserRole(Long id, Role newRole);
    void changePassword(Long userId, ChangePasswordRequest request);
    AuthResponse updateUsername(Long userId, UpdateUsernameRequest request);
    List<RankingEntry> getTop10Ranking();
    UserProfileDto getPublicProfile(String username);
    void updateBio(Long userId, UpdateBioRequest request);
    List<UserSearchDto> searchUsers(String query, Long currentUserId);
    Long getUserIdByUsername(String username);
    void muteUser(Long userId, long durationInSeconds);
}
