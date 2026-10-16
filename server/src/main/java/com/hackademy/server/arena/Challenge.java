package com.hackademy.server.arena;

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
    private String challengerAvatarSeed;
    private String targetAvatarSeed;

    public Challenge(String id, Long challengerId, String challengerUsername, Long targetId,
                     String targetUsername, LocalDateTime createdAt, String status) {
        this(id, challengerId, challengerUsername, targetId, targetUsername, createdAt, status,
                challengerUsername, targetUsername);
    }
}
