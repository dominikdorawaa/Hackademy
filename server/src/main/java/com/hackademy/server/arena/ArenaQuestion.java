package com.hackademy.server.arena;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
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

    @Column(name = "correct_answer", nullable = false, length = 200)
    private String correctAnswer;

    @Column(name = "wrong_answer_1", nullable = false, length = 200)
    private String wrongAnswer1;

    @Column(name = "wrong_answer_2", nullable = false, length = 200)
    private String wrongAnswer2;

    @Column(name = "wrong_answer_3", nullable = false, length = 200)
    private String wrongAnswer3;

    @Column(nullable = false, length = 30)
    private String category;

    @Column(nullable = false, length = 10)
    private String difficulty;

    @Version
    @Column(nullable = false)
    private long version;

    public List<String> wrongAnswers() {
        return List.of(wrongAnswer1, wrongAnswer2, wrongAnswer3);
    }
}
