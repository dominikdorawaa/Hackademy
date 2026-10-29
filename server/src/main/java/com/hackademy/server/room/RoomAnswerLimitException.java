package com.hackademy.server.room;

public class RoomAnswerLimitException extends RuntimeException {

    private final long retryAfterSeconds;

    public RoomAnswerLimitException(long retryAfterSeconds) {
        super("Zbyt wiele błędnych odpowiedzi w tym pokoju. Spróbuj ponownie za " + retryAfterSeconds + " s.");
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long retryAfterSeconds() {
        return retryAfterSeconds;
    }
}
