package com.hackademy.server.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RankingEntry {
    private Integer rankPoints; // Rank based on XP points
    private Integer rankElo;    // Rank based on ELO
    private String username;
    private Integer points;
    private Integer elo;
}
