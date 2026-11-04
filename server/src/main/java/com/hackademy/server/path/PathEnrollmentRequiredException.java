package com.hackademy.server.path;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

public class PathEnrollmentRequiredException extends ResponseStatusException {
    public static final String CODE = "PATH_ENROLLMENT_REQUIRED";

    private final transient List<Long> pathIds;

    public PathEnrollmentRequiredException(List<Long> pathIds) {
        super(HttpStatus.FORBIDDEN, "Dołącz do ścieżki, aby otworzyć ten pokój.");
        this.pathIds = List.copyOf(pathIds);
    }

    public List<Long> pathIds() {
        return pathIds;
    }
}
