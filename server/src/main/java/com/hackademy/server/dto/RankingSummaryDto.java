package com.hackademy.server.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RankingSummaryDto {
    private List<RankingEntry> ranking;
    private Map<String, Object> user;
    private RankingEntry myRank;
}

