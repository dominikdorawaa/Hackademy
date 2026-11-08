package com.hackademy.server.room.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.hackademy.server.room.Hint;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record HintDto(
    Long id,
    int order,
    String description
) {
    public static HintDto locked(Long id, int order) {
        return new HintDto(id, order, null);
    }

    public static HintDto of(Hint hint, int order, boolean unlocked) {
        return unlocked ? new HintDto(hint.getId(), order, hint.getDescription()) : locked(hint.getId(), order);
    }
}
