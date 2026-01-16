package com.hackademy.server.dto;

import com.hackademy.server.model.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileDto {
    private String username;
    private int points;
    private Role role;
    private LocalDateTime createdAt;
    private int streak;
    private String bio;
    private List<BadgeDto> badges;
}
