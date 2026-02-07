package com.hackademy.server.repository;

import com.hackademy.server.dto.RoomSummaryDto;
import com.hackademy.server.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {
    
    @Query("SELECT new com.hackademy.server.dto.RoomSummaryDto(" +
           "r.id, r.title, r.shortDescription, r.difficulty, r.category, r.points, r.solutionsCount, r.createdAt) " +
           "FROM Room r")
    List<RoomSummaryDto> findAllSummaries();
}
