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

    long countByPathId(Long pathId);

    @Query(value = "SELECT room_id FROM path_rooms WHERE path_id = :pathId ORDER BY sort_order ASC", nativeQuery = true)
    List<Long> findRoomIdsOrdered(@Param("pathId") Long pathId);

    @Transactional
    void deleteByPathId(Long pathId);
}

