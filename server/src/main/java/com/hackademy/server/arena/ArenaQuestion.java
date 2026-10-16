package com.hackademy.server.arena;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "arena_questions")
public class ArenaQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 500)
    private String content;

    @Column(name = "answer_a", nullable = false, length = 200)
    private String answerA;

    @Column(name = "answer_b", nullable = false, length = 200)
    private String answerB;

    @Column(name = "answer_c", nullable = false, length = 200)
    private String answerC;

    @Column(name = "answer_d", nullable = false, length = 200)
    private String answerD;

    @Column(name = "correct_answer", nullable = false)
    private int correctAnswer;

    @Column(nullable = false, length = 30)
    private String category;

    @Column(nullable = false, length = 10)
    private String difficulty;

    public List<String> answers() {
        return List.of(answerA, answerB, answerC, answerD);
    }
}
