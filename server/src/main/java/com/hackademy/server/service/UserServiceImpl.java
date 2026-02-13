package com.hackademy.server.service;

import com.hackademy.server.dto.AuthResponse;
import com.hackademy.server.dto.BadgeDto;
import com.hackademy.server.dto.ChangePasswordRequest;
import com.hackademy.server.dto.RankingEntry;
import com.hackademy.server.dto.UpdateBioRequest;
import com.hackademy.server.dto.UpdateUsernameRequest;
import com.hackademy.server.dto.UserAdminView;
import com.hackademy.server.dto.UserProfileDto;
import com.hackademy.server.dto.UserSearchDto;
import com.hackademy.server.exception.UserNotFoundException;
import com.hackademy.server.model.Role;
import com.hackademy.server.model.User;
import com.hackademy.server.repository.UserBadgeRepository;
import com.hackademy.server.repository.UserRepository;
import com.hackademy.server.repository.UserSolvedRoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final UserSolvedRoomRepository userSolvedRoomRepository;
    private final UserBadgeRepository userBadgeRepository; // Inject UserBadgeRepository
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final FriendshipService friendshipService;
    private final BadgeService badgeService;

    @Override
    public List<UserAdminView> findAllUsers() {
        return userRepository.findAll().stream()
                .map(this::mapUserToUserAdminView)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional // Ensure transactional deletion
    public void deleteUser(Long id) {
        if (!userRepository.existsById(id)) {
            throw new UserNotFoundException("User with ID: " + id + " not found.");
        }
        
        // Manually delete related entities to avoid constraint violation
        userBadgeRepository.deleteByUserId(id);
        
        // Also delete solved rooms if needed (though usually handled by cascade or separate repo)
        // Assuming UserSolvedRoom has cascade or we need to delete it too.
        // Let's check if UserSolvedRoomRepository has deleteByUserId
        // If not, we might need to add it too, but let's start with badges as that was the error.

        userRepository.deleteById(id);
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
    public void changePassword(Long userId, ChangePasswordRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new IllegalArgumentException("Incorrect current password");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    @Override
    public AuthResponse updateUsername(Long userId, UpdateUsernameRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        userRepository.findByUsername(request.getNewUsername()).ifPresent(existingUser -> {
            if (!existingUser.getId().equals(userId)) {
                throw new IllegalArgumentException("Username already taken");
            }
        });

        if (user.getUsername().equals(request.getNewUsername())) {
             String newToken = jwtService.generateToken(user);
             return new AuthResponse(newToken);
        }

        user.setUsername(request.getNewUsername());
        User updatedUser = userRepository.save(user);

        String newToken = jwtService.generateToken(updatedUser);
        return new AuthResponse(newToken);
    }

    @Override
    public List<RankingEntry> getTop10Ranking() {
        List<User> allUsers = userRepository.findAll();
        
        // Return top 100 users sorted by points, but include ELO so frontend can re-sort
        return allUsers.stream()
                .sorted((u1, u2) -> Integer.compare(u2.getPoints(), u1.getPoints()))
                .limit(100)
                .map(user -> new RankingEntry(
                        0, // Rank Points placeholder
                        0, // Rank Elo placeholder
                        user.getUsername(),
                        user.getPoints(),
                        user.getElo()
                ))
                .collect(Collectors.toList());
    }

    @Override
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
        List<BadgeDto> badges = badgeService.getUserBadges(user.getId());

        return UserProfileDto.builder()
                .username(user.getUsername())
                .points(user.getPoints())
                .role(user.getRole())
                .createdAt(user.getCreatedAt())
                .streak(effectiveStreak)
                .bio(user.getBio())
                .badges(badges) // Add badges to DTO
                .build();
    }

    @Override
    public void updateBio(Long userId, UpdateBioRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));
        user.setBio(request.getBio());
        userRepository.save(user);
    }

    @Override
    public List<UserSearchDto> searchUsers(String query, Long currentUserId) {
        List<User> users = userRepository.findByUsernameContainingIgnoreCase(query);
        
        return users.stream()
                .map(user -> {
                    String status = "NONE";
                    if (user.getId().equals(currentUserId)) {
                        status = "SELF";
                    } else {
                        status = friendshipService.getFriendshipStatus(currentUserId, user.getUsername());
                    }
                    
                    return UserSearchDto.builder()
                            .id(user.getId())
                            .username(user.getUsername())
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
    public void muteUser(Long userId, long durationInSeconds) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));
        
        // Use UTC time to ensure consistency across timezones
        if (durationInSeconds == -1) {
            // Permanent mute (e.g., 100 years)
            user.setMutedUntil(LocalDateTime.now(ZoneOffset.UTC).plusYears(100));
        } else {
            user.setMutedUntil(LocalDateTime.now(ZoneOffset.UTC).plusSeconds(durationInSeconds));
        }
        userRepository.save(user);
    }

    @Override
    public RankingEntry getUserRank(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));
        
        // Calculate rank based on points
        long rankPoints = userRepository.countByPointsGreaterThan(user.getPoints()) + 1;
        
        // Calculate rank based on ELO
        long rankElo = userRepository.countByEloGreaterThan(user.getElo()) + 1;
        
        return new RankingEntry((int) rankPoints, (int) rankElo, user.getUsername(), user.getPoints(), user.getElo());
    }

    @Override
    public boolean hasSolvedTutorialVpn(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));
        return userSolvedRoomRepository.existsByUser_UsernameAndRoom_Title(user.getUsername(), "Tutorial VPN");
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
