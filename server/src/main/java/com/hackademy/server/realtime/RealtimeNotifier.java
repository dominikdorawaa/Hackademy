package com.hackademy.server.realtime;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.HashSet;

@Component
@RequiredArgsConstructor
public class RealtimeNotifier {
    private final ApplicationEventPublisher events;

    public void changed(String... usernames) {
        events.publishEvent(new RealtimeChange(new HashSet<>(Arrays.asList(usernames))));
    }
}
