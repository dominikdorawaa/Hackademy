package com.hackademy.server.arena;

import com.hackademy.server.user.dto.UserAvatarDto;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import lombok.extern.slf4j.Slf4j;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

@Slf4j
@Converter
class AvatarJsonConverter implements AttributeConverter<UserAvatarDto, String> {
    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Override
    public String convertToDatabaseColumn(UserAvatarDto avatar) {
        if (avatar == null) return null;
        try {
            return JSON.writeValueAsString(avatar);
        } catch (JacksonException failure) {
            log.warn("Opponent avatar not saved with the arena match", failure);
            return null;
        }
    }

    @Override
    public UserAvatarDto convertToEntityAttribute(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return JSON.readValue(json, UserAvatarDto.class);
        } catch (JacksonException failure) {
            log.warn("Saved opponent avatar of an arena match is unreadable", failure);
            return null;
        }
    }
}
