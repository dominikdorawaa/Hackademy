package com.hackademy.server.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationPreferencesRepository extends JpaRepository<NotificationPreferences, Long> {
    @Modifying(clearAutomatically = true)
    @Query(value = """
            INSERT INTO user_notification_preferences
                (user_id, friend_requests, challenges, match_found, sound, browser_notifications, friend_online, friend_online_bell)
            VALUES (:userId, COALESCE(:friendRequests, TRUE), COALESCE(:challenges, TRUE),
                COALESCE(:matchFound, TRUE), COALESCE(:sound, FALSE), COALESCE(:browserNotifications, FALSE),
                COALESCE(:friendOnline, TRUE), COALESCE(:friendOnlineBell, TRUE))
            ON CONFLICT (user_id) DO UPDATE SET
                friend_requests = COALESCE(:friendRequests, user_notification_preferences.friend_requests),
                challenges = COALESCE(:challenges, user_notification_preferences.challenges),
                match_found = COALESCE(:matchFound, user_notification_preferences.match_found),
                sound = COALESCE(:sound, user_notification_preferences.sound),
                browser_notifications = COALESCE(:browserNotifications, user_notification_preferences.browser_notifications),
                friend_online = COALESCE(:friendOnline, user_notification_preferences.friend_online),
                friend_online_bell = COALESCE(:friendOnlineBell, user_notification_preferences.friend_online_bell)
            """, nativeQuery = true)
    int updatePreference(@Param("userId") Long userId, @Param("friendRequests") Boolean friendRequests,
            @Param("challenges") Boolean challenges, @Param("matchFound") Boolean matchFound,
            @Param("sound") Boolean sound, @Param("browserNotifications") Boolean browserNotifications,
            @Param("friendOnline") Boolean friendOnline, @Param("friendOnlineBell") Boolean friendOnlineBell);
}
