package com.hackademy.server.room;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RoomFileRepository extends JpaRepository<RoomFile, Long> {
    @org.springframework.data.jpa.repository.Query("SELECT f.fileName FROM RoomFile f WHERE f.room.id = :roomId")
    String findFileNameByRoomId(Long roomId);
    Optional<RoomFile> findByRoomId(Long roomId);
}
