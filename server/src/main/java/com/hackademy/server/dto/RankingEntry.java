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
    private Integer rank;
    private String username;
    private Integer points;
    private Integer elo;
}
