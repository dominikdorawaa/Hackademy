package com.hackademy.server.arena;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.hackademy.server.user.dto.UserAvatarDto;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

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
    private ArenaPause pause;
    private List<Long> pausesUsed = new ArrayList<>();
    private Map<Long, ArenaAbsence> absences = new HashMap<>();

    @JsonIgnore
    private List<QuestionSnapshot> questions = new ArrayList<>();
    @JsonIgnore
    private Map<Long, Integer> choices = new HashMap<>();
    @JsonIgnore
    private Map<Long, Long> answerElapsedMillis = new HashMap<>();
    @JsonIgnore
    private Set<Long> leftView = new HashSet<>();
    @JsonIgnore
    private Set<Long> forfeited = new HashSet<>();
    @JsonIgnore
    private Long botId;
    @JsonIgnore
    private BotMove botMove;
    @JsonIgnore
    private Map<Long, Long> queueTickets = new HashMap<>();

    public boolean includes(Long userId) {
        return player1Id.equals(userId) || player2Id.equals(userId);
    }

    public boolean isBot(Long playerId) {
        return botId != null && botId.equals(playerId);
    }

    public Long[] people() {
        return Stream.of(player1Id, player2Id).filter(player -> !isBot(player)).toArray(Long[]::new);
    }

    public int eloOf(Long playerId) {
        Integer elo = player1Id.equals(playerId) ? player1Elo : player2Elo;
        return elo == null ? QuestionDraw.DEFAULT_ELO : elo;
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
        copy.pause = pause;
        copy.pausesUsed = new ArrayList<>(pausesUsed);
        copy.absences = new HashMap<>(absences);
        return copy;
    }
}
