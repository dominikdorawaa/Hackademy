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
    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE Room r SET r.solutionsCount = r.solutionsCount + 1 WHERE r.id = :id")
    int incrementSolutions(@Param("id") Long id);
    /** Published and reachable: in at least one published path, or not assigned to any path yet. */
    String VISIBLE = "r.published = true AND (NOT EXISTS (SELECT acr.roomId FROM ChapterRoom acr WHERE acr.roomId = r.id) "
            + "OR EXISTS (SELECT vcr.roomId FROM ChapterRoom vcr JOIN PathChapter vc ON vc.id = vcr.chapterId JOIN Path vp ON vp.id = vc.pathId "
            + "WHERE vcr.roomId = r.id AND vp.published = true))";

    @Query("SELECT r.id FROM Room r WHERE " + VISIBLE)
    List<Long> findVisibleIds();

    @Query("SELECT COUNT(r) > 0 FROM Room r WHERE r.id = :id AND " + VISIBLE)
    boolean isVisible(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM Room r WHERE r.id = :id")
    Optional<Room> findByIdForUpdate(@Param("id") Long id);
    
    @Query("SELECT new com.hackademy.server.room.dto.RoomSummaryDto(" +
            "r.id, r.title, r.shortDescription, r.difficulty, r.category, r.points, r.solutionsCount, r.requiresVpn, r.roomType, r.createdAt) " +
            "FROM Room r JOIN ChapterRoom cr ON cr.roomId = r.id JOIN PathChapter c ON c.id = cr.chapterId " +
            "WHERE c.pathId = :pathId AND " + VISIBLE)
    List<RoomSummaryDto> findSummariesInPath(@Param("pathId") Long pathId);

    @Query("SELECT new com.hackademy.server.room.dto.RoomAdminSummaryDto(" +
           "r.id, r.title, r.category, r.difficulty, r.points, r.requiresVpn, r.roomType, r.published) " +
           "FROM Room r ORDER BY r.id")
    List<RoomAdminSummaryDto> findAllAdminSummaries();

    @Query("SELECT new com.hackademy.server.room.dto.RoomSummaryDto(" +
           "r.id, r.title, r.shortDescription, r.difficulty, r.category, r.points, r.solutionsCount, r.requiresVpn, r.roomType, r.createdAt) " +
           "FROM Room r WHERE " + VISIBLE + " AND r.category != :category ORDER BY r.solutionsCount DESC")
    List<RoomSummaryDto> findTop3ByCategoryNot(@Param("category") String category, Pageable pageable);
}
