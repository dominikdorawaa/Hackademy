package com.hackademy.server.repository;

import com.hackademy.server.model.RoomFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RoomFileRepository extends JpaRepository<RoomFile, Long> {
    Optional<RoomFile> findByRoomId(Long roomId);
}
