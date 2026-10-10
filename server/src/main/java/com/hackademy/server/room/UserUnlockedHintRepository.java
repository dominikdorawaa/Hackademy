package com.hackademy.server.room;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserUnlockedHintRepository extends JpaRepository<UserUnlockedHint, Long> {
    long countByUser_Id(Long userId);
    boolean existsByUser_IdAndHint_Id(Long userId, Long hintId);
    long countByUser_IdAndHint_Room_Id(Long userId, Long roomId);
    List<UserUnlockedHint> findByUser_IdAndHint_Room_Id(Long userId, Long roomId);
}
