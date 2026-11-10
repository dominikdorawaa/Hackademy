package com.hackademy.server.arena;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "arena_matches")
@Getter
@Setter
@NoArgsConstructor
public class ArenaMatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "game_id", nullable = false, length = 64)
    private String gameId;

    @Column(name = "opponent_name", nullable = false, length = 64)
    private String opponentName;

    @Column(nullable = false, length = 8)
    private String result;

    @Column(name = "elo_change", nullable = false)
    private int eloChange;

    @Column(name = "finished_at", nullable = false)
    private LocalDateTime finishedAt;
}
