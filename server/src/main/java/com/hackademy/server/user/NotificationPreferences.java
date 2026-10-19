package com.hackademy.server.user;

import com.hackademy.server.user.dto.NotificationPreferencesDto;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "user_notification_preferences")
@Getter
@NoArgsConstructor
public class NotificationPreferences {
    @Id
    @Column(name = "user_id")
    private Long userId;
    private boolean friendRequests;
    private boolean challenges;
    private boolean matchFound;
    private boolean sound;
    private boolean browserNotifications;
    private boolean friendOnline;

    public NotificationPreferences(Long userId, NotificationPreferencesDto preferences) {
        this.userId = userId;
        this.friendRequests = preferences.friendRequests();
        this.challenges = preferences.challenges();
        this.matchFound = preferences.matchFound();
        this.sound = preferences.sound();
        this.browserNotifications = preferences.browserNotifications();
        this.friendOnline = preferences.friendOnline();
    }

    public NotificationPreferencesDto toDto() {
        return new NotificationPreferencesDto(friendRequests, challenges, matchFound, sound, browserNotifications, friendOnline);
    }
}
