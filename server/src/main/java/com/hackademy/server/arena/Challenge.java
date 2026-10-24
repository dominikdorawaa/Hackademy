package com.hackademy.server.arena;

import com.hackademy.server.user.dto.UserAvatarDto;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Challenge {
    private String id;
    private Long challengerId;
    private String challengerUsername;
    private Long targetId;
    private String targetUsername;
    private LocalDateTime createdAt;
    private String status;
    private UserAvatarDto challengerAvatar;
    private UserAvatarDto targetAvatar;
    private long expiresAt;

    public Challenge(String id, Long challengerId, String challengerUsername, Long targetId,
                     String targetUsername, LocalDateTime createdAt, String status) {
        this(id, challengerId, challengerUsername, targetId, targetUsername, createdAt, status, null, null, 0);
    }
}
