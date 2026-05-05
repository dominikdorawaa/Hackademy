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
    private Integer rankPoints;
    private Integer rankElo;
    private String username;
    private Integer points;
    private Integer elo;
}
