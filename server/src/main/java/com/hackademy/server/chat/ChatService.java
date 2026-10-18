package com.hackademy.server.chat;

import java.util.List;

public interface ChatService {
    List<ChatMessage> getReportedMessages();
    void deleteMessage(Long messageId);
    void dismissReport(Long messageId);
}
