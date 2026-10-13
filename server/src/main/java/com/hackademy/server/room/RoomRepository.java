package com.hackademy.server.room;


import com.hackademy.server.room.dto.RoomAdminSummaryDto;
import com.hackademy.server.room.dto.RoomSummaryDto;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {
    String VISIBLE = "r.published = true AND NOT EXISTS (SELECT cr.roomId FROM ChapterRoom cr JOIN PathChapter c ON c.id = cr.chapterId JOIN Path p ON p.id = c.pathId WHERE cr.roomId = r.id AND p.published = false)";

    @Query("SELECT r.id FROM Room r WHERE " + VISIBLE)
    List<Long> findVisibleIds();

    @Query("SELECT COUNT(r) > 0 FROM Room r WHERE r.id = :id AND " + VISIBLE)
    boolean isVisible(@Param("id") Long id);

    boolean existsByTitleAndRoomType(String title, RoomType roomType);

    boolean existsByTitleAndRoomTypeAndIdNot(String title, RoomType roomType, Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM Room r WHERE r.id = :id")
    Optional<Room> findByIdForUpdate(@Param("id") Long id);
    
    @Query("SELECT new com.hackademy.server.room.dto.RoomSummaryDto(" +
           "r.id, r.title, r.shortDescription, r.difficulty, r.category, r.points, r.solutionsCount, r.requiresVpn, r.roomType, r.createdAt) " +
           "FROM Room r WHERE " + VISIBLE)
    List<RoomSummaryDto> findAllSummaries();

    @Query("SELECT new com.hackademy.server.room.dto.RoomAdminSummaryDto(" +
           "r.id, r.title, r.category, r.difficulty, r.points, r.requiresVpn, r.roomType, p.id, p.title, r.published) " +
           "FROM Room r " +
           "LEFT JOIN ChapterRoom cr ON cr.roomId = r.id " +
           "LEFT JOIN PathChapter c ON c.id = cr.chapterId " +
           "LEFT JOIN Path p ON p.id = c.pathId " +
           "ORDER BY r.id")
    List<RoomAdminSummaryDto> findAllAdminSummaries();

    // Native query for random room (PostgreSQL specific) - EXCLUDE TUTORIALS
    @Query(value = "SELECT * FROM rooms WHERE published = true AND room_type = 'CTF' AND category != 'Tutorial' ORDER BY RANDOM() LIMIT 1", nativeQuery = true)
    Optional<Room> findRandomRoom();

    // Exclude tutorials from ID list (used for random selection in service)
    @Query("SELECT r.id FROM Room r WHERE " + VISIBLE + " AND r.category != 'Tutorial'")
    List<Long> findAllIds();

    // Find IDs based on VPN requirement
    @Query("SELECT r.id FROM Room r WHERE " + VISIBLE + " AND r.category != 'Tutorial' AND (:vpnEnabled = true OR r.requiresVpn = false)")
    List<Long> findIdsByVpnRequirement(@Param("vpnEnabled") boolean vpnEnabled);

    @Query("SELECT r.id FROM Room r WHERE " + VISIBLE + " AND r.roomType = com.hackademy.server.room.RoomType.CTF AND r.category != 'Tutorial' AND (:vpnEnabled = true OR r.requiresVpn = false)")
    List<Long> findCtfIdsByVpnRequirement(@Param("vpnEnabled") boolean vpnEnabled);

    // Fetch top 3 rooms excluding Tutorial category using projection
    @Query("SELECT new com.hackademy.server.room.dto.RoomSummaryDto(" +
           "r.id, r.title, r.shortDescription, r.difficulty, r.category, r.points, r.solutionsCount, r.requiresVpn, r.roomType, r.createdAt) " +
           "FROM Room r WHERE " + VISIBLE + " AND r.category != :category ORDER BY r.solutionsCount DESC")
    List<RoomSummaryDto> findTop3ByCategoryNot(@Param("category") String category, Pageable pageable);
}
