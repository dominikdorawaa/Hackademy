package com.hackademy.server.config;

import com.hackademy.server.auth.JwtService;
import io.jsonwebtoken.JwtException;
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
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

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
        return message;
    }

    private Authentication authenticate(StompHeaderAccessor accessor) {
        try {
            var headers = accessor.getNativeHeader("Authorization");
            if (headers == null || headers.size() != 1 || !headers.get(0).startsWith("Bearer ")) {
                throw new BadCredentialsException("Invalid WebSocket credentials");
            }
            String token = headers.get(0).substring(7);
            String username = jwtService.extractUsername(token);
            if (username == null || username.isBlank()) {
                throw new BadCredentialsException("Invalid WebSocket credentials");
            }
            UserDetails userDetails = userDetailsService.loadUserByUsername(username);
            if (!jwtService.isTokenValid(token, userDetails)) {
                throw new BadCredentialsException("Invalid WebSocket credentials");
            }
            return new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
        } catch (JwtException | IllegalArgumentException | AuthenticationException exception) {
            throw new BadCredentialsException("Invalid WebSocket credentials");
        }
    }
}
