package com.hackademy.server.model;

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
    private String status; // PENDING, ACCEPTED, REJECTED, EXPIRED
    private boolean vpnEnabled;
}
