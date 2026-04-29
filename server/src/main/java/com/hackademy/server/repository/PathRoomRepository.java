package com.hackademy.server.repository;

import com.hackademy.server.model.PathRoom;
import com.hackademy.server.model.PathRoomId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface PathRoomRepository extends JpaRepository<PathRoom, PathRoomId> {

    interface PathRoomMiniRow {
        Long getId();
        String getTitle();
        Boolean getRequiresVpn();
        Boolean getSolved();
    }

    long countByPathId(Long pathId);

    @Query(value = "SELECT room_id FROM path_rooms WHERE path_id = :pathId ORDER BY sort_order ASC", nativeQuery = true)
    List<Long> findRoomIdsOrdered(@Param("pathId") Long pathId);

    @Query(value = """
            SELECT
              r.id AS id,
              r.title AS title,
              r.requires_vpn AS requiresVpn,
              (usr.room_id IS NOT NULL) AS solved
            FROM path_rooms pr
            JOIN rooms r ON r.id = pr.room_id
            LEFT JOIN user_solved_rooms usr
              ON usr.room_id = r.id AND usr.user_id = :userId
            WHERE pr.path_id = :pathId
            ORDER BY pr.sort_order ASC
            LIMIT :limit
            """, nativeQuery = true)
    List<PathRoomMiniRow> findMiniRoomsForUser(
            @Param("pathId") Long pathId,
            @Param("userId") Long userId,
            @Param("limit") int limit
    );

    @Transactional
    void deleteByPathId(Long pathId);
}

