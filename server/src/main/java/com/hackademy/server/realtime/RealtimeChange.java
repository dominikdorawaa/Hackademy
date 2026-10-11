package com.hackademy.server.realtime;

import java.util.Set;

public record RealtimeChange(Set<Long> userIds) {}
