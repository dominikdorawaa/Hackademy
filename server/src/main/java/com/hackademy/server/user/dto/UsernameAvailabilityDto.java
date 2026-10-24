package com.hackademy.server.user.dto;

public record UsernameAvailabilityDto(boolean available, String reason, String message) {
    public static final String LENGTH = "length";
    public static final String CHARACTERS = "characters";
    public static final String TAKEN = "taken";
}
