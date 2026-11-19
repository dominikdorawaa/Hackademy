package com.hackademy.server.arena.dto;

import com.hackademy.server.user.dto.UserAvatarDto;

import java.time.LocalDateTime;

public record ArenaMatchSummary(Long id, String opponentName, UserAvatarDto opponentAvatar,
                                String result, int eloChange, LocalDateTime finishedAt) {
}
