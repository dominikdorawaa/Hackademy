package com.hackademy.server.arena;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ArenaMatchRepository extends JpaRepository<ArenaMatch, Long> {
    @Query("select m.result, count(m) from ArenaMatch m where m.userId = :userId group by m.result")
    List<Object[]> countResults(@Param("userId") Long userId);

    List<ArenaMatch> findTop5ByUserIdOrderByIdDesc(Long userId);

    long countByUserIdAndFinishedAtGreaterThanEqual(Long userId, LocalDateTime since);

    @Query("select m.userId from ArenaMatch m where m.userId in :userIds and m.finishedAt >= :since group by m.userId having count(m) >= :games")
    List<Long> findUsersWithGamesSince(@Param("userIds") java.util.Collection<Long> userIds, @Param("since") LocalDateTime since, @Param("games") long games);

    @Query("""
            select count(m) from ArenaMatch m where m.userId = :userId and m.id > coalesce(
                (select max(n.id) from ArenaMatch n where n.userId = :userId and n.result <> 'WIN'), 0)
            """)
    long currentStreak(@Param("userId") Long userId);
}
