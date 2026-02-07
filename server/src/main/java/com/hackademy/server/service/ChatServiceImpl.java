package com.hackademy.server.service;

import com.hackademy.server.model.ChatMessage;
import com.hackademy.server.model.User;
import com.hackademy.server.repository.ChatMessageRepository;
import com.hackademy.server.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ChatServiceImpl implements ChatService {

    private final ChatMessageRepository chatMessageRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional
    public ChatMessage sendMessage(String gameId, Long senderId, String senderUsername, String content) {
        User user = userRepository.findById(senderId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // Check mute status using UTC
        if (user.getMutedUntil() != null && user.getMutedUntil().isAfter(LocalDateTime.now(ZoneOffset.UTC))) {
            throw new IllegalStateException("User is muted until " + user.getMutedUntil());
        }

        ChatMessage message = ChatMessage.builder()
                .gameId(gameId)
                .senderId(senderId)
                .senderUsername(senderUsername)
                .content(content)
                .build();
        return chatMessageRepository.save(message);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ChatMessage> getMessages(String gameId) {
        return chatMessageRepository.findByGameIdOrderByTimestampAsc(gameId);
    }

    @Override
    @Transactional
    public void reportMessage(Long messageId) {
        chatMessageRepository.findById(messageId).ifPresent(msg -> {
            msg.setReported(true);
            chatMessageRepository.save(msg);
        });
    }

    @Override
    @Transactional
    public void cleanupChat(String gameId) {
        // Delete only non-reported messages. Reported ones stay for admin review.
        chatMessageRepository.deleteByGameIdAndReportedFalse(gameId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ChatMessage> getReportedMessages() {
        return chatMessageRepository.findByReportedTrueOrderByTimestampDesc();
    }

    @Override
    @Transactional
    public void deleteMessage(Long messageId) {
        chatMessageRepository.deleteById(messageId);
    }

    @Override
    @Transactional
    public void dismissReport(Long messageId) {
        chatMessageRepository.findById(messageId).ifPresent(msg -> {
            msg.setReported(false);
            chatMessageRepository.save(msg);
        });
    }
}
