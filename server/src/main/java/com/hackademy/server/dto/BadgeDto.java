package com.hackademy.server.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BadgeDto {
    private Long id;
    private String name;
    private String description;
    private String icon;
    private LocalDateTime earnedAt; // Null if not earned
    private boolean earned;
}
