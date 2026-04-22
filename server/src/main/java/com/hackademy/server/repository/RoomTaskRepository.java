package com.hackademy.server.repository;

import com.hackademy.server.model.RoomTask;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RoomTaskRepository extends JpaRepository<RoomTask, Long> {
    List<RoomTask> findByRoomIdOrderBySortOrderAsc(Long roomId);
}
