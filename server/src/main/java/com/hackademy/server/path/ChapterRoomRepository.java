package com.hackademy.server.path;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface ChapterRoomRepository extends JpaRepository<ChapterRoom, Long> {

    interface RoomOwnerView {
        Long getRoomId();
        Long getPathId();
        String getPathTitle();
    }

    interface PathRoomMiniRow {
        Long getId();
        String getTitle();
        Boolean getRequiresVpn();
        Boolean getSolved();
    }

    @Query("""
            SELECT cr FROM ChapterRoom cr
            WHERE cr.chapterId IN (SELECT c.id FROM PathChapter c WHERE c.pathId = :pathId)
            ORDER BY cr.sortOrder ASC, cr.roomId ASC
            """)
    List<ChapterRoom> findByPathId(@Param("pathId") Long pathId);

    @Query(value = """
            SELECT cr.room_id
            FROM chapter_rooms cr
            JOIN path_chapters pc ON pc.id = cr.chapter_id
            WHERE pc.path_id = :pathId
            ORDER BY pc.sort_order ASC, pc.id ASC, cr.sort_order ASC, cr.room_id ASC
            """, nativeQuery = true)
    List<Long> findRoomIdsOrdered(@Param("pathId") Long pathId);

    @Query(value = """
            SELECT cr.room_id AS roomId, p.id AS pathId, p.title AS pathTitle
            FROM chapter_rooms cr
            JOIN path_chapters pc ON pc.id = cr.chapter_id
            JOIN paths p ON p.id = pc.path_id
            WHERE cr.room_id IN (:roomIds)
            """, nativeQuery = true)
    List<RoomOwnerView> findOwners(@Param("roomIds") Collection<Long> roomIds);

    @Query(value = """
            SELECT
              r.id AS id,
              r.title AS title,
              r.requires_vpn AS requiresVpn,
              (usr.room_id IS NOT NULL) AS solved
            FROM chapter_rooms cr
            JOIN path_chapters pc ON pc.id = cr.chapter_id
            JOIN rooms r ON r.id = cr.room_id
            LEFT JOIN user_solved_rooms usr
              ON usr.room_id = r.id AND usr.user_id = :userId
            WHERE pc.path_id = :pathId
            ORDER BY pc.sort_order ASC, pc.id ASC, cr.sort_order ASC, cr.room_id ASC
            LIMIT :limit
            """, nativeQuery = true)
    List<PathRoomMiniRow> findMiniRoomsForUser(
            @Param("pathId") Long pathId,
            @Param("userId") Long userId,
            @Param("limit") int limit
    );

    boolean existsByRoomId(Long roomId);

    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM ChapterRoom cr WHERE cr.chapterId IN (SELECT c.id FROM PathChapter c WHERE c.pathId = :pathId)")
    void deleteByPathId(@Param("pathId") Long pathId);
}
