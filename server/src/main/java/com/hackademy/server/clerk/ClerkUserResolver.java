package com.hackademy.server.clerk;

import com.hackademy.server.user.Role;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ClerkUserResolver {

    private final UserRepository userRepository;
    private final UsernameGenerator usernameGenerator;

    public User resolve(Jwt jwt) {
        String clerkUserId = jwt.getSubject();
        Optional<User> linked = userRepository.findByClerkUserId(clerkUserId);
        if (linked.isPresent()) {
            return syncEmail(linked.get(), jwt);
        }
        try {
            return link(jwt, clerkUserId);
        } catch (DataIntegrityViolationException exception) {
            return userRepository.findByClerkUserId(clerkUserId)
                    .orElseThrow(() -> new BadCredentialsException("Clerk account conflicts with an existing account", exception));
        }
    }

    private User link(Jwt jwt, String clerkUserId) {
        String email = verifiedEmail(jwt)
                .orElseThrow(() -> new BadCredentialsException("Clerk account has no verified email address"));
        Optional<User> sameEmail = userRepository.findByEmail(email);
        if (sameEmail.isPresent()) {
            if (clerkUserId.equals(sameEmail.get().getClerkUserId())) return sameEmail.get();
            throw new BadCredentialsException("Existing accounts must be linked by the offline import");
        }
        User user = User.builder()
                .username(usernameGenerator.generate())
                .email(email)
                .role(Role.USER)
                .clerkUserId(clerkUserId)
                .build();
        log.info("Created a local account for a new Clerk user");
        return userRepository.saveAndFlush(user);
    }

    private User syncEmail(User user, Jwt jwt) {
        Optional<String> email = verifiedEmail(jwt);
        if (email.isEmpty() || email.get().equals(user.getEmail())) {
            return user;
        }
        if (userRepository.findByEmail(email.get()).isPresent()) {
            return user;
        }
        try {
            if (userRepository.updateClerkEmail(user.getId(), user.getClerkUserId(), email.get()) == 1) user.setEmail(email.get());
            return user;
        } catch (DataIntegrityViolationException exception) {
            return userRepository.findByClerkUserId(user.getClerkUserId()).orElse(user);
        }
    }

    static Optional<String> verifiedEmail(Jwt jwt) {
        String email = jwt.getClaimAsString("email");
        Object verified = jwt.getClaims().get("email_verified");
        boolean isVerified = Boolean.TRUE.equals(verified) || "true".equals(verified);
        if (email == null || email.isBlank() || !isVerified) {
            return Optional.empty();
        }
        return Optional.of(email.trim().toLowerCase(Locale.ROOT));
    }
}
