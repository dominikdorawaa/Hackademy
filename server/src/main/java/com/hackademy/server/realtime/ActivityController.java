package com.hackademy.server.realtime;

import com.hackademy.server.friendship.FriendshipService;
import com.hackademy.server.room.RoomRepository;
import com.hackademy.server.user.User;
import com.hackademy.server.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/presence")
@RequiredArgsConstructor
public class ActivityController {
    private final FriendPresence presence;
    private final RoomRepository rooms;
    private final UserRepository users;
    private final FriendshipService friendships;

    public record SharingRequest(boolean enabled) {}

    @PutMapping("/room/{roomId}")
    public ResponseEntity<Void> openRoom(Authentication authentication, @PathVariable Long roomId) {
        if (!rooms.existsById(roomId)) return ResponseEntity.notFound().build();
        presence.openRoom(userId(authentication), roomId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/room/{roomId}")
    public ResponseEntity<Void> closeRoom(Authentication authentication, @PathVariable Long roomId) {
        presence.closeRoom(userId(authentication), roomId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/sharing")
    public Map<String, Boolean> sharing(Authentication authentication) {
        return Map.of("enabled", users.findById(userId(authentication)).map(User::isShareActivity).orElse(true));
    }

    @PutMapping("/sharing")
    @Transactional
    public Map<String, Boolean> updateSharing(Authentication authentication, @RequestBody SharingRequest request) {
        User user = users.findById(userId(authentication)).orElseThrow();
        user.setShareActivity(request.enabled());
        users.save(user);
        friendships.invalidateProfileCaches(user.getId());
        return Map.of("enabled", user.isShareActivity());
    }

    private static Long userId(Authentication authentication) {
        return ((User) authentication.getPrincipal()).getId();
    }
}
