package com.hackademy.server.user;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AccountDeletionRepository extends JpaRepository<AccountDeletion, Long> {

    boolean existsByClerkUserId(String clerkUserId);
}
