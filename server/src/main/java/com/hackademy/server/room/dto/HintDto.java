package com.hackademy.server.room.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

// A locked hint carries only its id and order; the description is left out of the JSON entirely.
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
