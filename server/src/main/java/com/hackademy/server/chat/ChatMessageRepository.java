package com.hackademy.server.chat;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findByGameIdOrderByTimestampAsc(String gameId);
    void deleteByGameIdAndReportedFalse(String gameId);
    List<ChatMessage> findByReportedTrueOrderByTimestampDesc();
}
