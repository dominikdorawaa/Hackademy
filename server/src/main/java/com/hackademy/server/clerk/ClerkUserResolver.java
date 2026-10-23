package com.hackademy.server.clerk;

import com.hackademy.server.user.Role;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import com.hackademy.server.user.AccountDeletionRepository;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Optional;

@Slf4j
@Service
public class ClerkUserResolver {

    private final UserRepository userRepository;
    private final UsernameGenerator usernameGenerator;

    private final AccountDeletionRepository deletions;
    private final TransactionTemplate transaction;

    public ClerkUserResolver(UserRepository userRepository, UsernameGenerator usernameGenerator,
                             AccountDeletionRepository deletions, PlatformTransactionManager transactionManager) {
        this.userRepository = userRepository;
        this.usernameGenerator = usernameGenerator;
        this.deletions = deletions;
        this.transaction = new TransactionTemplate(transactionManager);
    }

    public User resolve(Jwt jwt) {
        Optional<User> existing = userRepository.findByClerkUserId(jwt.getSubject());
        rejectDeleted(jwt.getSubject());
        if (existing.isPresent() && verifiedEmail(jwt).map(email -> email.equals(existing.get().getEmail())).orElse(true)) {
            return existing.get();
        }
        try {
            return transaction.execute(status -> resolveInTransaction(jwt));
        } catch (DataIntegrityViolationException exception) {
            return transaction.execute(status -> {
                var linked = userRepository.findByClerkUserIdForUpdate(jwt.getSubject());
                rejectDeleted(jwt.getSubject());
                return linked.orElseThrow(() -> new BadCredentialsException("Clerk account conflicts with an existing account", exception));
            });
        }
    }

    private void rejectDeleted(String clerkUserId) {
        if (deletions.existsByClerkUserId(clerkUserId)) {
            throw new BadCredentialsException("Clerk account has been deleted");
        }
    }

    private User resolveInTransaction(Jwt jwt) {
        String clerkUserId = jwt.getSubject();
        Optional<User> linked = userRepository.findByClerkUserIdForUpdate(clerkUserId);
        rejectDeleted(clerkUserId);
        if (linked.isPresent()) {
            return syncEmail(linked.get(), jwt);
        }
        return link(jwt, clerkUserId);
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
        User saved = userRepository.saveAndFlush(user);
        rejectDeleted(clerkUserId);
        return saved;
    }

    private User syncEmail(User user, Jwt jwt) {
        Optional<String> email = verifiedEmail(jwt);
        if (email.isEmpty() || email.get().equals(user.getEmail())) {
            return user;
        }
        if (userRepository.findByEmail(email.get()).isPresent()) {
            return user;
        }
        if (userRepository.updateClerkEmail(user.getId(), user.getClerkUserId(), email.get()) == 1) user.setEmail(email.get());
        return user;
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
