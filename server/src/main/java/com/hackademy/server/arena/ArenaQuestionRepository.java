package com.hackademy.server.arena;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ArenaQuestionRepository extends JpaRepository<ArenaQuestion, Long> {

    @Query(value = "SELECT * FROM arena_questions ORDER BY random() LIMIT :count", nativeQuery = true)
    List<ArenaQuestion> findRandom(@Param("count") int count);
}
