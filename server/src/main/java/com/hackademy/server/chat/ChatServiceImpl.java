package com.hackademy.server.chat;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ChatServiceImpl implements ChatService {

    private final ChatMessageRepository chatMessageRepository;

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
