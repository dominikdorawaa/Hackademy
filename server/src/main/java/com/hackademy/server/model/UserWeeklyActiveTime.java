package com.hackademy.server.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_weekly_active_time")
@IdClass(UserWeeklyActiveTimeId.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserWeeklyActiveTime {

    @Id
    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Id
    @Column(name = "week_key", nullable = false, length = 16)
    private String weekKey;

    @Column(name = "seconds", nullable = false)
    private int seconds;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}

