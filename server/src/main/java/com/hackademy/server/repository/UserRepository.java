package com.hackademy.server.repository;

import com.hackademy.server.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    List<User> findByUsernameContainingIgnoreCase(String username);

    long countByPointsGreaterThan(Integer points);
    
    long countByEloGreaterThan(Integer elo);
}
