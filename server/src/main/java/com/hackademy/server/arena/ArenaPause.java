package com.hackademy.server.arena;

import java.util.List;

public record ArenaPause(List<Long> players, long startedAt, long endsAt) {}
