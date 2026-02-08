package com.hackademy.server.repository;

import com.hackademy.server.dto.RoomAdminSummaryDto;
import com.hackademy.server.dto.RoomSummaryDto;
import com.hackademy.server.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {
    
    @Query("SELECT new com.hackademy.server.dto.RoomSummaryDto(" +
           "r.id, r.title, r.shortDescription, r.difficulty, r.category, r.points, r.solutionsCount, r.createdAt) " +
           "FROM Room r")
    List<RoomSummaryDto> findAllSummaries();

    @Query("SELECT new com.hackademy.server.dto.RoomAdminSummaryDto(" +
           "r.id, r.title, r.category, r.difficulty, r.points) " +
           "FROM Room r")
    List<RoomAdminSummaryDto> findAllAdminSummaries();

    // Native query for random room (PostgreSQL specific)
    @Query(value = "SELECT * FROM rooms ORDER BY RANDOM() LIMIT 1", nativeQuery = true)
    Optional<Room> findRandomRoom();

    @Query("SELECT r.id FROM Room r")
    List<Long> findAllIds();
}
