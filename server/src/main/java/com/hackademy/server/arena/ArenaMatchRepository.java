package com.hackademy.server.arena;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ArenaMatchRepository extends JpaRepository<ArenaMatch, Long> {
    long countByUserId(Long userId);

    long countByUserIdAndResult(Long userId, String result);

    List<ArenaMatch> findTop10ByUserIdOrderByFinishedAtDescIdDesc(Long userId);
}
