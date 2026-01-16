package com.hackademy.server.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserSearchDto {
    private Long id;
    private String username;
    private int points;
    private String friendshipStatus; // NONE, FRIENDS, REQUEST_SENT, REQUEST_RECEIVED, SELF
    private int winsAgainst; // How many times current user won against this user
    private int lossesAgainst; // How many times current user lost against this user
}
