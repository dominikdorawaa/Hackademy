package com.hackademy.server.arena;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.hackademy.server.user.dto.UserAvatarDto;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
public class GameSession {
    private String id;
    private Long player1Id;
    private String player1Username;
    private UserAvatarDto player1Avatar;
    private Integer player1Elo;

    private Long player2Id;
    private String player2Username;
    private UserAvatarDto player2Avatar;
    private Integer player2Elo;

    private LocalDateTime startTime;
    private String status;
    private Long winnerId;
    private String finishReason;
    private Integer player1EloChange;
    private Integer player2EloChange;

    private int round;
    private int totalRounds;
    private String phase;
    private long roundEndsAt;
    private long nextRoundAt;
    private long serverTime;
    private Map<Long, Integer> hp = new HashMap<>();
    private List<Long> answeredBy = new ArrayList<>();
    private BattleQuestion question;
    private RoundResult lastRound;
    private List<ArenaReaction> reactions = new ArrayList<>();

    @JsonIgnore
    private List<ArenaQuestion> questions = new ArrayList<>();
    @JsonIgnore
    private Map<Long, Integer> choices = new HashMap<>();
    @JsonIgnore
    private Map<Long, Long> disconnectedSince = new HashMap<>();

    public boolean includes(Long userId) {
        return player1Id.equals(userId) || player2Id.equals(userId);
    }

    public Long opponentOf(Long userId) {
        return player1Id.equals(userId) ? player2Id : player1Id;
    }

    public synchronized GameSession snapshot() {
        GameSession copy = new GameSession();
        copy.id = id;
        copy.player1Id = player1Id;
        copy.player1Username = player1Username;
        copy.player1Avatar = player1Avatar;
        copy.player1Elo = player1Elo;
        copy.player2Id = player2Id;
        copy.player2Username = player2Username;
        copy.player2Avatar = player2Avatar;
        copy.player2Elo = player2Elo;
        copy.startTime = startTime;
        copy.status = status;
        copy.winnerId = winnerId;
        copy.finishReason = finishReason;
        copy.player1EloChange = player1EloChange;
        copy.player2EloChange = player2EloChange;
        copy.round = round;
        copy.totalRounds = totalRounds;
        copy.phase = phase;
        copy.roundEndsAt = roundEndsAt;
        copy.nextRoundAt = nextRoundAt;
        copy.serverTime = System.currentTimeMillis();
        copy.hp = new HashMap<>(hp);
        copy.answeredBy = new ArrayList<>(answeredBy);
        copy.question = question;
        copy.lastRound = lastRound;
        copy.reactions = new ArrayList<>(reactions);
        return copy;
    }
}
