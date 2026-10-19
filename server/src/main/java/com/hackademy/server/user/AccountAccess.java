package com.hackademy.server.user;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AccountAccess {

    private final AccountDeletionRepository deletions;
    private final UserRepository users;

    public boolean isActive(Long userId) {
        return !deletions.existsById(userId) && users.existsById(userId);
    }
}
