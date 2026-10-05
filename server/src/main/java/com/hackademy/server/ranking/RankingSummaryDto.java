package com.hackademy.server.ranking;

import lombok.Builder;
import java.util.List;
import java.util.Map;

@Builder
public record RankingSummaryDto(
    List<RankingEntry> ranking,
    Map<String, Object> user,
    RankingEntry myRank
) {}
