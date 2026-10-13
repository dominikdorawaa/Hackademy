package com.hackademy.server.room;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public class RoomRuleException extends ResponseStatusException {
    private final String field;

    public RoomRuleException(HttpStatus status, String field, String message) {
        super(status, message);
        this.field = field;
    }

    public String field() {
        return field;
    }
}
