package com.hackademy.server.room;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface UserCompletedTaskRepository extends JpaRepository<UserCompletedTask, Long> {
    boolean existsByUserIdAndTaskId(Long userId, Long taskId);
    List<UserCompletedTask> findByUserId(Long userId);
    
    @org.springframework.data.jpa.repository.Query("SELECT uct.taskId FROM UserCompletedTask uct WHERE uct.userId = :userId")
    List<Long> findCompletedTaskIdsByUserId(Long userId);
    
    @org.springframework.data.jpa.repository.Query("SELECT u.taskId FROM UserCompletedTask u JOIN RoomTask t ON t.id = u.taskId WHERE u.userId = :userId AND t.room.id = :roomId")
    List<Long> findCompletedTaskIdsInRoom(Long userId, Long roomId);

    long countByUserIdAndTaskIdIn(Long userId, List<Long> taskIds);
}
