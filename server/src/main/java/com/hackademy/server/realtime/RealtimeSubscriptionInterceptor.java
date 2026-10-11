package com.hackademy.server.realtime;

import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageHandler;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.simp.user.UserDestinationMessageHandler;
import org.springframework.messaging.support.ExecutorChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

@Component
public class RealtimeSubscriptionInterceptor implements ExecutorChannelInterceptor {
    private final SimpMessagingTemplate messaging;

    public RealtimeSubscriptionInterceptor(@Lazy SimpMessagingTemplate messaging) {
        this.messaging = messaging;
    }

    @Override
    public void afterMessageHandled(Message<?> message, MessageChannel channel, MessageHandler handler, Exception exception) {
        var accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (exception != null || !(handler instanceof UserDestinationMessageHandler) || accessor == null
                || accessor.getCommand() != StompCommand.SUBSCRIBE
                || !"/user/queue/realtime".equals(accessor.getDestination()) || accessor.getUser() == null) return;
        var headers = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        headers.setSessionId(accessor.getSessionId());
        headers.setLeaveMutable(true);
        messaging.convertAndSendToUser(accessor.getUser().getName(), "/queue/realtime",
                new RealtimeDelivery.Envelope("READY", null), headers.getMessageHeaders());
    }
}
