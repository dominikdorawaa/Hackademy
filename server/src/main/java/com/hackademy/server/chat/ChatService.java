package com.hackademy.server.chat;

import java.util.List;

public interface ChatService {
    List<ChatMessage> getReportedMessages();
    org.springframework.data.domain.Slice<ChatMessage> getReportsPage(int page, int size);
    void deleteMessage(Long messageId);
    void dismissReport(Long messageId);
}
