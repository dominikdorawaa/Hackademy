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

import com.hackademy.server.user.dto.UserAvatarDto;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Convert;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

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

    @Column(name = "opponent_id")
    private Long opponentId;

    @Column(name = "opponent_bot", nullable = false)
    private boolean opponentBot;

    @Column(name = "finish_reason", length = 16)
    private String finishReason;

    @Column(name = "elo_before")
    private Integer eloBefore;

    @Column(name = "opponent_elo")
    private Integer opponentElo;

    private Integer hp;

    @Column(name = "opponent_hp")
    private Integer opponentHp;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Convert(converter = AvatarJsonConverter.class)
    @Column(name = "opponent_avatar", columnDefinition = "text")
    private UserAvatarDto opponentAvatar;

    @OneToMany(mappedBy = "match", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("roundNumber")
    private List<ArenaMatchRound> rounds = new ArrayList<>();
}
