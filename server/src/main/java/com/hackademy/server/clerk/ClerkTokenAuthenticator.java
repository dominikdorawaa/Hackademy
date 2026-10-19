package com.hackademy.server.clerk;

import com.hackademy.server.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ClerkTokenAuthenticator {

    static final String BEARER_PREFIX = "Bearer ";

    private final JwtDecoder clerkJwtDecoder;
    private final ClerkUserResolver userResolver;

    public UsernamePasswordAuthenticationToken authenticateHeader(String authorization) {
        if (authorization == null || !authorization.startsWith(BEARER_PREFIX)) {
            throw new BadCredentialsException("Missing bearer token");
        }
        return authenticate(authorization.substring(BEARER_PREFIX.length()).trim());
    }

    public UsernamePasswordAuthenticationToken authenticate(String token) {
        if (token == null || token.isBlank()) {
            throw new BadCredentialsException("Missing bearer token");
        }
        User user;
        try {
            user = userResolver.resolve(clerkJwtDecoder.decode(token));
        } catch (JwtException exception) {
            throw new BadCredentialsException("Invalid Clerk session token", exception);
        }
        return UsernamePasswordAuthenticationToken.authenticated(user, null, user.getAuthorities());
    }
}
