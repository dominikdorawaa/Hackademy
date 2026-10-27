package com.hackademy.server.user;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.hackademy.server.badge.UserBadgeRepository;
import com.hackademy.server.clerk.ClerkBackendClient;
import com.hackademy.server.clerk.ClerkProperties;
import com.hackademy.server.exception.UserNotFoundException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class AccountDeletionService {

    static final int PASSWORD_ATTEMPTS = 5;
    static final String WRONG_PASSWORD = "Hasło jest nieprawidłowe.";
    static final String WRONG_CONFIRMATION = "Wpisana nazwa nie zgadza się z nazwą Twojego konta.";
    static final String LAST_ADMIN = "Jesteś jedynym administratorem. Nadaj rolę administratora innej osobie, zanim usuniesz to konto.";

    private final UserRepository users;
    private final AccountDeletionRepository deletions;
    private final UserBadgeRepository badges;
    private final ClerkProperties properties;
    private final RestClient.Builder clientBuilder;
    private final ApplicationEventPublisher events;
    private final TransactionTemplate transaction;
    private final Cache<Long, AtomicInteger> failedConfirmations = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofMinutes(15)).maximumSize(10_000).build();

    public AccountDeletionService(UserRepository users, AccountDeletionRepository deletions, UserBadgeRepository badges,
                                  ClerkProperties properties, RestClient.Builder clientBuilder,
                                  ApplicationEventPublisher events, PlatformTransactionManager transactionManager) {
        this.users = users;
        this.deletions = deletions;
        this.badges = badges;
        this.properties = properties;
        this.clientBuilder = clientBuilder;
        this.events = events;
        this.transaction = new TransactionTemplate(transactionManager);
        this.transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public void confirmOwner(Long userId, String password, String confirmation) {
        var user = users.findById(userId).orElseThrow(() -> new UserNotFoundException("User not found"));
        if (user.getClerkUserId() == null) throw new ResponseStatusException(HttpStatus.FORBIDDEN, WRONG_PASSWORD);
        if (properties.secretKey() == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Usuwanie kont Clerk nie jest skonfigurowane.");
        }
        var failures = failedConfirmations.get(userId, ignored -> new AtomicInteger());
        if (failures.get() >= PASSWORD_ATTEMPTS) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Zbyt wiele nieudanych prób. Spróbuj ponownie za 15 minut.");
        }
        boolean passwordEnabled;
        boolean confirmed;
        try {
            var clerk = new ClerkBackendClient(clientBuilder.clone(), properties);
            passwordEnabled = clerk.passwordEnabled(user.getClerkUserId());
            confirmed = passwordEnabled
                    ? password != null && !password.isEmpty() && clerk.verifyPassword(user.getClerkUserId(), password)
                    : confirmation != null && confirmation.trim().equals(user.getUsername());
        } catch (RestClientException | IllegalStateException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Nie udało się potwierdzić tożsamości. Spróbuj ponownie.");
        }
        if (!confirmed) {
            failures.incrementAndGet();
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, passwordEnabled ? WRONG_PASSWORD : WRONG_CONFIRMATION);
        }
        failedConfirmations.invalidate(userId);
    }

    public void delete(Long userId) {
        AccountDeletion deletion = transaction.execute(status -> {
            var user = users.findByIdForUpdate(userId);
            var previous = deletions.findById(userId);
            if (previous.isPresent()) return previous.get();
            var target = user.orElseThrow(() -> new UserNotFoundException("User not found"));
            if (target.getRole() == Role.ADMIN && users.countByRole(Role.ADMIN) <= 1) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, LAST_ADMIN);
            }
            if (target.getClerkUserId() != null && properties.secretKey() == null) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Usuwanie kont Clerk nie jest skonfigurowane.");
            }
            return deletions.saveAndFlush(new AccountDeletion(userId, target.getClerkUserId()));
        });
        events.publishEvent(new AccountBlockedEvent(userId));
        if (deletion.getClerkUserId() != null) {
            try {
                new ClerkBackendClient(clientBuilder.clone(), properties).delete(deletion.getClerkUserId());
            } catch (RestClientException | IllegalStateException exception) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "Konto zablokowano. Nie udało się potwierdzić usunięcia w Clerk. Ponów usuwanie.");
            }
        }
        transaction.executeWithoutResult(status -> {
            var user = users.findByIdForUpdate(userId);
            if (user.isEmpty()) return;
            if (!Objects.equals(user.get().getClerkUserId(), deletion.getClerkUserId())) {
                throw new IllegalStateException("Account identity changed during deletion");
            }
            badges.deleteByUserId(userId);
            users.delete(user.get());
            users.flush();
        });
    }
}
