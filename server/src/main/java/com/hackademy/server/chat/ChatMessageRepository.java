package com.hackademy.server.chat;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    org.springframework.data.domain.Slice<ChatMessage> findByReportedTrueOrderByTimestampDescIdDesc(org.springframework.data.domain.Pageable pageable);
    List<ChatMessage> findByReportedTrueOrderByTimestampDesc();
}
