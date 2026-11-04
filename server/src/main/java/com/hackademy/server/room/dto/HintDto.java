package com.hackademy.server.room.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record HintDto(
    Long id,
    int order,
    String description
) {
    public static HintDto locked(Long id, int order) {
        return new HintDto(id, order, null);
    }
}
