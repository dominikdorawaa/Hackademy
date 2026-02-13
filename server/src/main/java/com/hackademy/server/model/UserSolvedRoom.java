package com.hackademy.server.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_solved_rooms", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"user_id", "room_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserSolvedRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Room room;

    @CreationTimestamp
    @Column(name = "solved_at", nullable = false, updatable = false)
    private LocalDateTime solvedAt;

    public UserSolvedRoom(User user, Room room) {
        this.user = user;
        this.room = room;
    }
}
