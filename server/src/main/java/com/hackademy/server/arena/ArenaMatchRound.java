package com.hackademy.server.arena;

import com.hackademy.server.arena.dto.ArenaMatchRoundView;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Entity
@Table(name = "arena_match_rounds")
@Getter
@Setter
@NoArgsConstructor
public class ArenaMatchRound {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "match_id", nullable = false)
    private ArenaMatch match;

    @Column(name = "round_number", nullable = false)
    private int roundNumber;

    @Column(name = "question_id")
    private Long questionId;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(nullable = false, length = 32)
    private String category;

    @Column(length = 16)
    private String difficulty;

    @Column(name = "answer_1", nullable = false, columnDefinition = "text")
    private String answer1;

    @Column(name = "answer_2", nullable = false, columnDefinition = "text")
    private String answer2;

    @Column(name = "answer_3", nullable = false, columnDefinition = "text")
    private String answer3;

    @Column(name = "answer_4", nullable = false, columnDefinition = "text")
    private String answer4;

    @Column(name = "correct_answer", nullable = false)
    private int correctAnswer;

    private Integer choice;

    @Column(name = "answer_millis")
    private Integer answerMillis;

    @Column(name = "opponent_choice")
    private Integer opponentChoice;

    @Column(name = "opponent_answer_millis")
    private Integer opponentAnswerMillis;

    @Column(name = "hp_after", nullable = false)
    private int hpAfter;

    @Column(name = "opponent_hp_after", nullable = false)
    private int opponentHpAfter;

    public List<String> answers() {
        return List.of(answer1, answer2, answer3, answer4);
    }

    ArenaMatchRoundView view() {
        return new ArenaMatchRoundView(roundNumber, content, category, difficulty, answers(), correctAnswer, choice,
                answerMillis, opponentChoice, opponentAnswerMillis, hpAfter, opponentHpAfter);
    }

    static ArenaMatchRound of(ArenaMatch match, PlayedRound played, Long player, Long opponent) {
        ArenaMatchRound round = new ArenaMatchRound();
        QuestionSnapshot question = played.question();
        round.match = match;
        round.roundNumber = played.round();
        round.questionId = question.id();
        round.content = question.content();
        round.category = question.category();
        round.difficulty = question.difficulty();
        round.answer1 = question.answers().get(0);
        round.answer2 = question.answers().get(1);
        round.answer3 = question.answers().get(2);
        round.answer4 = question.answers().get(3);
        round.correctAnswer = question.correctAnswer();
        round.choice = played.choiceOf(player);
        round.answerMillis = played.millisOf(player);
        round.opponentChoice = played.choiceOf(opponent);
        round.opponentAnswerMillis = played.millisOf(opponent);
        round.hpAfter = played.hpAfter().getOrDefault(player, 0);
        round.opponentHpAfter = played.hpAfter().getOrDefault(opponent, 0);
        return round;
    }
}
