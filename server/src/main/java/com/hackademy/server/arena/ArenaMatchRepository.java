package com.hackademy.server.arena;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ArenaMatchRepository extends JpaRepository<ArenaMatch, Long> {
    @Query("select m.result, count(m) from ArenaMatch m where m.userId = :userId group by m.result")
    List<Object[]> countResults(@Param("userId") Long userId);

    List<ArenaMatch> findTop5ByUserIdOrderByIdDesc(Long userId);

    @Query("""
            select count(m) from ArenaMatch m where m.userId = :userId and m.id > coalesce(
                (select max(n.id) from ArenaMatch n where n.userId = :userId and n.result <> 'WIN'), 0)
            """)
    long currentStreak(@Param("userId") Long userId);
}
