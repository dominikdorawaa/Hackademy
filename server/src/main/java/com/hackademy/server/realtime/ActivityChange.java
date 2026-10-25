package com.hackademy.server.realtime;

import java.util.Set;

public record ActivityChange(Set<Long> userIds) {
}
