package com.hackademy.server.config;

import com.hackademy.server.clerk.ClerkTokenAuthenticator;
import com.hackademy.server.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    private final ClerkTokenAuthenticator authenticator;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor == null || accessor.getCommand() == null || accessor.getCommand() == StompCommand.DISCONNECT) {
            return message;
        }

        if (accessor.getCommand() == StompCommand.CONNECT || accessor.getCommand() == StompCommand.STOMP) {
            accessor.setUser(authenticate(accessor));
        } else if (!(accessor.getUser() instanceof Authentication authentication) || !authentication.isAuthenticated()) {
            throw new BadCredentialsException("WebSocket authentication required");
        }
        if (accessor.getCommand() == StompCommand.SUBSCRIBE
                && !"/user/queue/realtime".equals(accessor.getDestination())) {
            throw new BadCredentialsException("WebSocket subscription not allowed");
        }
        if (accessor.getCommand() == StompCommand.SEND) {
            throw new BadCredentialsException("WebSocket destination not allowed");
        }
        return message;
    }

    private Authentication authenticate(StompHeaderAccessor accessor) {
        try {
            var headers = accessor.getNativeHeader("Authorization");
            if (headers == null || headers.size() != 1) {
                throw new BadCredentialsException("Invalid WebSocket credentials");
            }
            var authentication = authenticator.authenticateHeader(headers.get(0));
            if (!(authentication.getPrincipal() instanceof User user) || user.getId() == null) {
                throw new BadCredentialsException("Invalid WebSocket credentials");
            }
            return new UsernamePasswordAuthenticationToken(user.getId().toString(), null, authentication.getAuthorities());
        } catch (AuthenticationException exception) {
            throw new BadCredentialsException("Invalid WebSocket credentials");
        }
    }
}
