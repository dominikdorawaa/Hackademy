package com.hackademy.server.realtime;

import java.util.Set;

public record RealtimeChange(Set<Long> userIds, boolean social) {
    public RealtimeChange(Set<Long> userIds) { this(userIds, true); }
}
