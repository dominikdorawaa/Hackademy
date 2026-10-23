package com.hackademy.server.user;

import com.hackademy.server.user.dto.ProfilePersonalizationDto;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class CurrentProfileDetails {
    private final JdbcTemplate jdbc;

    public ProfilePersonalizationDto read(User user) {
        return new ProfilePersonalizationDto(user.getBio() == null ? "" : user.getBio(), user.getTagline(),
                jdbc.queryForList("SELECT interest FROM user_profile_interests WHERE user_id = ? ORDER BY position", String.class, user.getId()),
                jdbc.queryForList("SELECT badge_id FROM user_featured_badges WHERE user_id = ? ORDER BY position", Long.class, user.getId()));
    }
}
