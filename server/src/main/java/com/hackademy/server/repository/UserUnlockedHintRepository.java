package com.hackademy.server.repository;

import com.hackademy.server.model.UserUnlockedHint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserUnlockedHintRepository extends JpaRepository<UserUnlockedHint, Long> {
    boolean existsByUser_IdAndHint_Id(Long userId, Long hintId);
    long countByUser_IdAndHint_Room_Id(Long userId, Long roomId);
    List<UserUnlockedHint> findByUser_IdAndHint_Room_Id(Long userId, Long roomId);
}
