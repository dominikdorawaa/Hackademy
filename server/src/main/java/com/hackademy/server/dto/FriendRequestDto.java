package com.hackademy.server.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FriendRequestDto {
    private Long id;
    private String requesterUsername;
    private LocalDateTime createdAt;
}
