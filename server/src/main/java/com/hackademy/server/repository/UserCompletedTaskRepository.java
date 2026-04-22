package com.hackademy.server.repository;

import com.hackademy.server.model.UserCompletedTask;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface UserCompletedTaskRepository extends JpaRepository<UserCompletedTask, Long> {
    boolean existsByUserIdAndTaskId(Long userId, Long taskId);
    List<UserCompletedTask> findByUserId(Long userId);
    
    @org.springframework.data.jpa.repository.Query("SELECT uct.taskId FROM UserCompletedTask uct WHERE uct.userId = :userId")
    List<Long> findCompletedTaskIdsByUserId(Long userId);
    
    long countByUserIdAndTaskIdIn(Long userId, List<Long> taskIds);
}
