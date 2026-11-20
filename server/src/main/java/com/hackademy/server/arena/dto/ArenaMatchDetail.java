package com.hackademy.server.arena.dto;

import java.util.List;

public record ArenaMatchDetail(ArenaMatchSummary summary, String finishReason, Integer eloBefore, Integer opponentElo,
                               Integer hp, Integer opponentHp, Integer durationSeconds,
                               List<ArenaMatchRoundView> rounds) {
}
