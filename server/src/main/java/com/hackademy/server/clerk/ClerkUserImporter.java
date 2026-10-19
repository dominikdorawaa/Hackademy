package com.hackademy.server.clerk;

import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import lombok.extern.slf4j.Slf4j;

import java.util.Optional;

@Slf4j
public class ClerkUserImporter {

    private final UserRepository userRepository;
    private final ClerkBackendClient client;

    public ClerkUserImporter(UserRepository userRepository, ClerkBackendClient client) {
        this.userRepository = userRepository;
        this.client = client;
    }

    public ImportResult importAll() {
        int created = 0;
        int linked = 0;
        int failed = 0;
        for (User user : userRepository.findByClerkUserIdIsNullOrderByIdAsc()) {
            try {
                Outcome outcome = importUser(user);
                if (outcome == Outcome.CREATED) created++;
                else linked++;
            } catch (RuntimeException exception) {
                failed++;
                log.warn("Could not import local account {} into Clerk: {}", user.getId(), exception.getMessage());
            }
        }
        ImportResult result = new ImportResult(created, linked, failed);
        log.info("Clerk import finished: {} created, {} linked, {} failed", created, linked, failed);
        return result;
    }

    Outcome importUser(User user) {
        String externalId = user.getId().toString();
        Optional<ClerkBackendClient.ClerkUser> existing = client.findByExternalId(externalId).stream().findFirst();
        if (existing.isPresent()) {
            save(user, existing.get().id());
            return Outcome.LINKED;
        }
        save(user, client.create(externalId, user.getEmail(), user.getPassword()).id());
        return Outcome.CREATED;
    }

    private void save(User user, String clerkUserId) {
        if (clerkUserId == null || clerkUserId.isBlank()) {
            throw new IllegalStateException("Clerk did not return a user id");
        }
        user.setClerkUserId(clerkUserId);
        userRepository.saveAndFlush(user);
    }

    enum Outcome { CREATED, LINKED }

    public record ImportResult(int created, int linked, int failed) {
    }
}
