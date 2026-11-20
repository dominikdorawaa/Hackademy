package com.hackademy.server.subscription;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "subscriptions")
@Getter
@Setter
@NoArgsConstructor
public class Subscription {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "active_until", nullable = false)
    private LocalDateTime activeUntil;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
