package com.hackademy.server.controller;

import com.hackademy.server.model.ChatMessage;
import com.hackademy.server.model.User;
import com.hackademy.server.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.PATCH, RequestMethod.DELETE, RequestMethod.OPTIONS})
public class ChatController {

    private final ChatService chatService;

    @GetMapping("/{gameId}")
    public ResponseEntity<List<ChatMessage>> getMessages(@PathVariable String gameId) {
        return ResponseEntity.ok(chatService.getMessages(gameId));
    }

    @PostMapping("/{gameId}/send")
    public ResponseEntity<?> sendMessage(@PathVariable String gameId, @RequestBody Map<String, String> payload) {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        String content = payload.get("content");
        
        if (content == null || content.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        try {
            return ResponseEntity.ok(chatService.sendMessage(gameId, user.getId(), user.getUsername(), content));
        } catch (IllegalStateException e) {
            // Check if it's a mute message
            if (e.getMessage().startsWith("User is muted until")) {
                String dateStr = e.getMessage().replace("User is muted until ", "");
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "message", "User is muted",
                    "mutedUntil", dateStr
                ));
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/message/{messageId}/report")
    public ResponseEntity<?> reportMessage(@PathVariable Long messageId) {
        chatService.reportMessage(messageId);
        return ResponseEntity.ok(Map.of("message", "Message reported"));
    }
}
