package com.hackademy.server.path;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

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

    interface ProgressionRow {
        Long getChapterId();
        Long getRoomId();
        Boolean getSolved();
    }

    @Query(value = """
            SELECT
              pc.id AS chapterId,
              cr.room_id AS roomId,
              (usr.room_id IS NOT NULL) AS solved
            FROM path_chapters pc
            LEFT JOIN (chapter_rooms cr JOIN rooms r ON r.id = cr.room_id AND r.published = true)
              ON cr.chapter_id = pc.id
            LEFT JOIN user_solved_rooms usr
              ON usr.room_id = cr.room_id AND usr.user_id = :userId
            WHERE pc.path_id = :pathId
            ORDER BY pc.sort_order ASC, pc.id ASC, cr.sort_order ASC, cr.room_id ASC
            """, nativeQuery = true)
    List<ProgressionRow> findProgression(@Param("pathId") Long pathId, @Param("userId") Long userId);

    interface RoomPathView {
        Long getPathId();
        String getUnlockMode();
    }

    @Query(value = """
            SELECT p.id AS pathId, p.unlock_mode AS unlockMode
            FROM chapter_rooms cr
            JOIN path_chapters pc ON pc.id = cr.chapter_id
            JOIN paths p ON p.id = pc.path_id
            WHERE cr.room_id = :roomId
            """, nativeQuery = true)
    Optional<RoomPathView> findPathOfRoom(@Param("roomId") Long roomId);

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
            WHERE pc.path_id = :pathId AND r.published = true
            ORDER BY pc.sort_order ASC, pc.id ASC, cr.sort_order ASC, cr.room_id ASC
            LIMIT :limit
            """, nativeQuery = true)
    List<PathRoomMiniRow> findMiniRoomsForUser(
            @Param("pathId") Long pathId,
            @Param("userId") Long userId,
            @Param("limit") int limit
    );

    boolean existsByRoomId(Long roomId);

    @Query(value = """
            SELECT EXISTS (
              SELECT 1
              FROM chapter_rooms own
              JOIN chapter_rooms other ON other.chapter_id = own.chapter_id AND other.room_id <> own.room_id
              WHERE own.room_id = :roomId AND other.room_title = :title
            )
            """, nativeQuery = true)
    boolean existsOtherRoomWithTitleInSameChapter(@Param("roomId") Long roomId, @Param("title") String title);

    @Query(value = "SELECT EXISTS (SELECT 1 FROM chapter_rooms WHERE chapter_id = :chapterId AND room_title = :title)", nativeQuery = true)
    boolean existsRoomWithTitleInChapter(@Param("chapterId") Long chapterId, @Param("title") String title);

    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM ChapterRoom cr WHERE cr.chapterId IN (SELECT c.id FROM PathChapter c WHERE c.pathId = :pathId)")
    void deleteByPathId(@Param("pathId") Long pathId);
}
