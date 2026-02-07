package com.hackademy.server.service;

import com.hackademy.server.model.ChatMessage;
import java.util.List;

public interface ChatService {
    ChatMessage sendMessage(String gameId, Long senderId, String senderUsername, String content);
    List<ChatMessage> getMessages(String gameId);
    void reportMessage(Long messageId);
    void cleanupChat(String gameId);
    List<ChatMessage> getReportedMessages();
    void deleteMessage(Long messageId);
    void dismissReport(Long messageId);
}
