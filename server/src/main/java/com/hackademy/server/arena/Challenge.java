package com.hackademy.server.arena;

import com.hackademy.server.user.dto.UserAvatarDto;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

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
    private Integer challengerElo;
    private Integer targetElo;

    public Challenge(String id, Long challengerId, String challengerUsername, Long targetId,
                     String targetUsername, LocalDateTime createdAt, String status) {
        this(id, challengerId, challengerUsername, targetId, targetUsername, createdAt, status, null, null, 0, null, null);
    }

    public Challenge withAvatars(Map<Long, UserAvatarDto> avatars) {
        return new Challenge(id, challengerId, challengerUsername, targetId, targetUsername, createdAt, status,
                avatars.get(challengerId), avatars.get(targetId), expiresAt, challengerElo, targetElo);
    }
}
