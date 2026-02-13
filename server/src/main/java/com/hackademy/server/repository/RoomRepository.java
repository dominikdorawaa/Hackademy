package com.hackademy.server.repository;

import com.hackademy.server.dto.RoomAdminSummaryDto;
import com.hackademy.server.dto.RoomSummaryDto;
import com.hackademy.server.model.Room;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {
    
    @Query("SELECT new com.hackademy.server.dto.RoomSummaryDto(" +
           "r.id, r.title, r.shortDescription, r.difficulty, r.category, r.points, r.solutionsCount, r.requiresVpn, r.createdAt) " +
           "FROM Room r")
    List<RoomSummaryDto> findAllSummaries();

    @Query("SELECT new com.hackademy.server.dto.RoomAdminSummaryDto(" +
           "r.id, r.title, r.category, r.difficulty, r.points, r.requiresVpn) " +
           "FROM Room r")
    List<RoomAdminSummaryDto> findAllAdminSummaries();

    // Native query for random room (PostgreSQL specific) - EXCLUDE TUTORIALS
    @Query(value = "SELECT * FROM rooms WHERE category != 'Tutorial' ORDER BY RANDOM() LIMIT 1", nativeQuery = true)
    Optional<Room> findRandomRoom();

    // Exclude tutorials from ID list (used for random selection in service)
    @Query("SELECT r.id FROM Room r WHERE r.category != 'Tutorial'")
    List<Long> findAllIds();

    // Find IDs based on VPN requirement
    @Query("SELECT r.id FROM Room r WHERE r.category != 'Tutorial' AND (:vpnEnabled = true OR r.requiresVpn = false)")
    List<Long> findIdsByVpnRequirement(@Param("vpnEnabled") boolean vpnEnabled);

    // Fetch top 3 rooms excluding Tutorial category using projection
    @Query("SELECT new com.hackademy.server.dto.RoomSummaryDto(" +
           "r.id, r.title, r.shortDescription, r.difficulty, r.category, r.points, r.solutionsCount, r.requiresVpn, r.createdAt) " +
           "FROM Room r WHERE r.category != :category ORDER BY r.solutionsCount DESC")
    List<RoomSummaryDto> findTop3ByCategoryNot(@Param("category") String category, Pageable pageable);
}
