package com.hackademy.server.user;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE u.username = :username")
    Optional<User> findByUsernameForUpdate(String username);

    @Query("SELECT u.id FROM User u WHERE u.username = :username")
    Optional<Long> findIdByUsername(String username);

    @Query("SELECT u FROM User u WHERE lower(u.username) = lower(:username)")
    Optional<User> findByUsernameIgnoringCase(String username);

    Optional<User> findByEmail(String email);

    Optional<User> findByClerkUserId(String clerkUserId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE u.id = :id")
    Optional<User> findByIdForUpdate(Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE u.clerkUserId = :clerkUserId")
    Optional<User> findByClerkUserIdForUpdate(String clerkUserId);

    List<User> findByClerkUserIdIsNullOrderByIdAsc();

    long countByRole(Role role);

    @Modifying
    @Transactional
    @Query("UPDATE User u SET u.lastSeenAt = :at WHERE u.id = :id")
    int markSeen(Long id, java.time.LocalDateTime at);

    @Modifying
    @Transactional
    @Query("UPDATE User u SET u.email = :email WHERE u.id = :id AND u.clerkUserId = :clerkUserId")
    int updateClerkEmail(Long id, String clerkUserId, String email);

    @Query("SELECT new com.hackademy.server.admin.UserAdminView(u.id, u.username, u.email, u.role, u.createdAt) FROM User u WHERE LOCATE(LOWER(:query), LOWER(u.username)) > 0 ORDER BY u.id DESC")
    org.springframework.data.domain.Slice<com.hackademy.server.admin.UserAdminView> findAdminPage(@org.springframework.data.repository.query.Param("query") String query, Pageable pageable);

    List<User> findByUsernameContainingIgnoreCase(String username);

    @Query("SELECT u FROM User u WHERE LOCATE(LOWER(:query), LOWER(u.username)) > 0 ORDER BY u.username, u.id")
    List<User> searchLimited(@org.springframework.data.repository.query.Param("query") String query, Pageable pageable);

    @Query("SELECT u FROM User u ORDER BY u.points DESC")
    List<User> findTopByPointsDesc(Pageable pageable);

    @Query(value = """
            SELECT id, username, points, elo, rank_points AS "rankPoints", rank_elo AS "rankElo"
            FROM (
                SELECT id, username, COALESCE(points, 0) AS points, COALESCE(elo, 500) AS elo,
                    RANK() OVER (ORDER BY COALESCE(points, 0) DESC) AS rank_points,
                    RANK() OVER (ORDER BY COALESCE(elo, 500) DESC) AS rank_elo,
                    ROW_NUMBER() OVER (ORDER BY COALESCE(points, 0) DESC, username) AS points_order,
                    ROW_NUMBER() OVER (ORDER BY COALESCE(elo, 500) DESC, username) AS elo_order
                FROM users
            ) ranked
            WHERE points_order <= 100 OR elo_order <= 100
            ORDER BY rank_points, username
            """, nativeQuery = true)
    List<RankingRow> findRankingLeaders();

    long countByPointsGreaterThan(Integer points);
    
    long countByEloGreaterThan(Integer elo);
}
