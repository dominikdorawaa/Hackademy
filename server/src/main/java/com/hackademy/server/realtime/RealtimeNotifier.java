package com.hackademy.server.realtime;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class RealtimeNotifier {
    private final ApplicationEventPublisher events;

    public void arenaChanged(Long... userIds) {
        events.publishEvent(new RealtimeChange(Set.copyOf(Arrays.asList(userIds)), false));
    }

    public void changed(Long... userIds) {
        events.publishEvent(new RealtimeChange(Set.copyOf(Arrays.asList(userIds))));
    }
}
