package com.hackademy.server.arena;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.random.RandomGenerator;

public interface ArenaQuestionRepository extends JpaRepository<ArenaQuestion, Long> {

    @Query("SELECT new com.hackademy.server.arena.QuestionLevel(q.id, q.difficulty) FROM ArenaQuestion q")
    List<QuestionLevel> findLevels();

    default List<ArenaQuestion> drawForElo(int elo, int count, RandomGenerator random) {
        List<Long> ids = QuestionDraw.pick(findLevels(), elo, count, random);
        Map<Long, ArenaQuestion> found = new HashMap<>();
        findAllById(ids).forEach(question -> found.put(question.getId(), question));
        return ids.stream().map(found::get).filter(Objects::nonNull).toList();
    }

    @Query("""
            SELECT q FROM ArenaQuestion q
            WHERE (LOCATE(LOWER(:query), LOWER(q.content)) > 0
                OR LOCATE(LOWER(:query), LOWER(q.correctAnswer)) > 0 OR LOCATE(LOWER(:query), LOWER(q.wrongAnswer1)) > 0
                OR LOCATE(LOWER(:query), LOWER(q.wrongAnswer2)) > 0 OR LOCATE(LOWER(:query), LOWER(q.wrongAnswer3)) > 0)
              AND (:category = '' OR q.category = :category)
              AND (:difficulty = '' OR q.difficulty = :difficulty)
            ORDER BY q.id DESC
            """)
    Slice<ArenaQuestion> findAdminPage(@Param("query") String query, @Param("category") String category,
                                       @Param("difficulty") String difficulty, Pageable pageable);

    // Locks every row so two concurrent deletions cannot both see a second question and empty the bank.
    @Query(value = "SELECT id FROM arena_questions ORDER BY id FOR UPDATE", nativeQuery = true)
    List<Long> lockAllIds();
}
