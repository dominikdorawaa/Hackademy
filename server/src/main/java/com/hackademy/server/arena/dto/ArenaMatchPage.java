package com.hackademy.server.arena.dto;

import java.util.List;

public record ArenaMatchPage(List<ArenaMatchSummary> items, boolean hasMore) {
}
