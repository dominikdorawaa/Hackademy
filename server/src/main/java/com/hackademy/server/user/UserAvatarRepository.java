package com.hackademy.server.user;

import com.hackademy.server.user.dto.UserAvatarDto;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.Map;
import java.util.stream.Collectors;

public interface UserAvatarRepository extends JpaRepository<UserAvatar, Long> {

    default Map<Long, UserAvatarDto> findDtosByUserIds(Collection<Long> userIds) {
        if (userIds.isEmpty()) return Map.of();
        return findAllById(userIds).stream().collect(Collectors.toMap(UserAvatar::getUserId, UserAvatar::toDto));
    }

    default UserAvatarDto findDtoByUserId(Long userId) {
        return findById(userId).map(UserAvatar::toDto).orElse(null);
    }
}
