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

    List<User> findByClerkUserIdIsNullOrderByIdAsc();

    @Modifying
    @Transactional
    @Query("UPDATE User u SET u.email = :email WHERE u.id = :id AND u.clerkUserId = :clerkUserId")
    int updateClerkEmail(Long id, String clerkUserId, String email);

    List<User> findByUsernameContainingIgnoreCase(String username);

    @Query("SELECT u FROM User u ORDER BY u.points DESC")
    List<User> findTopByPointsDesc(Pageable pageable);

    long countByPointsGreaterThan(Integer points);
    
    long countByEloGreaterThan(Integer elo);
}
