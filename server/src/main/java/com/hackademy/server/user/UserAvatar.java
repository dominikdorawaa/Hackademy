package com.hackademy.server.user;

import com.hackademy.server.user.dto.UserAvatarDto;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "user_avatars")
public class UserAvatar {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false, length = 16)
    private String outfit;

    @Column(nullable = false, length = 16)
    private String hair;

    @Column(nullable = false, length = 16)
    private String hat;

    @Column(nullable = false, length = 16)
    private String skin;

    @Column(name = "hair_color", nullable = false, length = 16)
    private String hairColor;

    @Column(name = "top_color", nullable = false, length = 16)
    private String topColor;

    @Column(name = "bottom_color", nullable = false, length = 16)
    private String bottomColor;

    @Column(name = "shoes_color", nullable = false, length = 16)
    private String shoesColor;

    @Column(name = "hat_color", nullable = false, length = 16)
    private String hatColor;

    @Column(nullable = false, length = 16)
    private String pose = UserAvatarDto.DEFAULT_POSE;

    @Column(nullable = false, length = 16)
    private String finisher = UserAvatarDto.DEFAULT_FINISHER;

    @Column(name = "victory_dance", nullable = false, length = 16)
    private String victoryDance = UserAvatarDto.DEFAULT_VICTORY_DANCE;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public static UserAvatar of(Long userId, UserAvatarDto dto) {
        UserAvatar avatar = new UserAvatar();
        avatar.setUserId(userId);
        avatar.apply(dto);
        return avatar;
    }

    public void apply(UserAvatarDto dto) {
        outfit = dto.outfit();
        hair = dto.hair();
        hat = dto.hat();
        skin = dto.skin();
        hairColor = dto.hairColor();
        topColor = dto.topColor();
        bottomColor = dto.bottomColor();
        shoesColor = dto.shoesColor();
        hatColor = dto.hatColor();
        pose = dto.pose() == null ? UserAvatarDto.DEFAULT_POSE : dto.pose();
        if (dto.finisher() != null) finisher = dto.finisher();
        if (dto.victoryDance() != null) victoryDance = dto.victoryDance();
    }

    public UserAvatarDto toDto() {
        return new UserAvatarDto(outfit, hair, hat, skin, hairColor, topColor, bottomColor, shoesColor, hatColor, pose, finisher, victoryDance);
    }
}
