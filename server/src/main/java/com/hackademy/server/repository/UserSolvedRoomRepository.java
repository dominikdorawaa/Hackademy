package com.hackademy.server.repository;

import com.hackademy.server.model.UserSolvedRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserSolvedRoomRepository extends JpaRepository<UserSolvedRoom, Long> {
    boolean existsByUser_IdAndRoom_Id(Long userId, Long roomId);
    boolean existsByUser_UsernameAndRoom_Title(String username, String roomTitle);
    long countByUser_Id(Long userId);
    List<UserSolvedRoom> findByUser_Id(Long userId);
}
