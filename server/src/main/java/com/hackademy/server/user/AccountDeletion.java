package com.hackademy.server.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "account_deletions")
@Getter
@NoArgsConstructor
public class AccountDeletion {

    @Id
    private Long userId;

    @Column(unique = true, length = 64)
    private String clerkUserId;

    public AccountDeletion(Long userId, String clerkUserId) {
        this.userId = userId;
        this.clerkUserId = clerkUserId;
    }
}
