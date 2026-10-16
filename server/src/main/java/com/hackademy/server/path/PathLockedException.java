package com.hackademy.server.path;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public class PathLockedException extends ResponseStatusException {
    public PathLockedException(String reason) {
        super(HttpStatus.FORBIDDEN, reason);
    }
}
