package com.hackademy.server.user;

import com.hackademy.server.badge.UserBadgeRepository;
import com.hackademy.server.clerk.ClerkBackendClient;
import com.hackademy.server.clerk.ClerkProperties;
import com.hackademy.server.exception.UserNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

import java.util.Objects;

@Service
public class AccountDeletionService {

    private final UserRepository users;
    private final AccountDeletionRepository deletions;
    private final UserBadgeRepository badges;
    private final ClerkProperties properties;
    private final RestClient.Builder clientBuilder;
    private final TransactionTemplate transaction;

    public AccountDeletionService(UserRepository users, AccountDeletionRepository deletions, UserBadgeRepository badges,
                                  ClerkProperties properties, RestClient.Builder clientBuilder,
                                  PlatformTransactionManager transactionManager) {
        this.users = users;
        this.deletions = deletions;
        this.badges = badges;
        this.properties = properties;
        this.clientBuilder = clientBuilder;
        this.transaction = new TransactionTemplate(transactionManager);
        this.transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public void delete(Long userId) {
        AccountDeletion deletion = transaction.execute(status -> {
            var user = users.findByIdForUpdate(userId);
            var previous = deletions.findById(userId);
            if (previous.isPresent()) return previous.get();
            var target = user.orElseThrow(() -> new UserNotFoundException("User not found"));
            if (target.getClerkUserId() != null && properties.secretKey() == null) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Usuwanie kont Clerk nie jest skonfigurowane.");
            }
            return deletions.saveAndFlush(new AccountDeletion(userId, target.getClerkUserId()));
        });
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
