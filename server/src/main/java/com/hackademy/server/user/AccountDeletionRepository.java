package com.hackademy.server.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface AccountDeletionRepository extends JpaRepository<AccountDeletion, Long> {

    boolean existsByClerkUserId(String clerkUserId);

    @Query("SELECT d FROM AccountDeletion d WHERE d.userId IN (SELECT u.id FROM User u)")
    List<AccountDeletion> findPending();
}
