package com.hackademy.server.repository;

import com.hackademy.server.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    @Query("SELECT u.id FROM User u WHERE u.username = :username")
    Optional<Long> findIdByUsername(String username);

    Optional<User> findByEmail(String email);

    List<User> findByUsernameContainingIgnoreCase(String username);

    @Query("SELECT u FROM User u ORDER BY u.points DESC")
    List<User> findTopByPointsDesc(Pageable pageable);

    long countByPointsGreaterThan(Integer points);
    
    long countByEloGreaterThan(Integer elo);
}
